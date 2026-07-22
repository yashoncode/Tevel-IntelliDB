import {
   AiTable, AiTableRef, AskSchemaParams, ChatParams, ExplainSqlParams, GenerateSqlParams,
   RawColumnMeta, RawKeyUsageMeta
} from 'common/interfaces/ai';
import * as antares from 'common/interfaces/antares';
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { runNlToSql } from '../libs/ai/pipeline/NlToSqlPipeline';
import { AiProvider, createProvider } from '../libs/ai/providers/AiProvider';
import { retrieveRankedRefs, VectorCache } from '../libs/ai/schema-intelligence/EmbeddingRetriever';
import { buildSchemaAnswerPrompt } from '../libs/ai/schema-intelligence/PromptBuilder';
import { buildTableSnapshot } from '../libs/ai/schema-intelligence/SchemaSnapshot';
import { validateSender } from '../libs/misc/validateSender';

// On-disk vector cache: one JSON file per connection+schema under userData. Best-effort
// any read/write failure just means we re-embed. No native module, no vector DB process.
const vectorCache: VectorCache = {
   get (key) {
      try {
         const file = path.join(app.getPath('userData'), 'tevel-embeddings', `${key.replace(/[^a-z0-9_.-]/gi, '_')}.json`);
         return JSON.parse(fs.readFileSync(file, 'utf-8'));
      }
      catch {
         return null;
      }
   },
   set (key, entry) {
      try {
         const dir = path.join(app.getPath('userData'), 'tevel-embeddings');
         fs.mkdirSync(dir, { recursive: true });
         fs.writeFileSync(path.join(dir, `${key.replace(/[^a-z0-9_.-]/gi, '_')}.json`), JSON.stringify(entry));
      }
      catch { /* cache is best-effort */ }
   }
};

export default (connections: Record<string, antares.Client>) => {
   // Load full metadata (columns + FKs) for the retrieved tables. METADATA ONLY
   // never getTableData / row-returning methods.
   async function enrichTables (conn: antares.Client, refs: AiTableRef[]): Promise<AiTable[]> {
      const out: AiTable[] = [];
      for (const ref of refs) {
         const columns = await conn.getTableColumns({ schema: ref.schema, table: ref.name });
         let keyUsage: RawKeyUsageMeta[] = [];
         try {
            keyUsage = await conn.getKeyUsage({ schema: ref.schema, table: ref.name }) as unknown as RawKeyUsageMeta[];
         }
         catch { /* some clients/tables lack key usage; FKs are optional */ }
         out.push(buildTableSnapshot(ref, columns as unknown as RawColumnMeta[], keyUsage));
      }
      return out;
   }

   // Hybrid retrieval: keyword ranker + cached embeddings (falls back to keyword-only).
   function retrieve (params: GenerateSqlParams | AskSchemaParams, provider: AiProvider): Promise<AiTableRef[]> {
      return retrieveRankedRefs({
         question: params.question,
         tables: params.tables,
         vocabulary: params.vocabulary,
         limit: params.maxTables ?? 12,
         provider,
         cache: vectorCache,
         cacheKey: `${params.uid}::${params.schema}`,
         useEmbeddings: !!params.useEmbeddings && !!provider.embed && !!params.provider.embedModel,
         onError: err => console.warn('[ai] embeddings unavailable, using keyword rank:', err.message)
      });
   }

   // Verify provider credentials with a tiny round-trip.
   ipcMain.handle('ai:test-connection', async (event, params: ChatParams) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      try {
         const provider = createProvider(params.provider);
         const reply = await provider.chat([
            { role: 'user', content: 'Reply with the single word: ok' }
         ], { maxTokens: 8 });
         return { status: 'success', response: reply.trim() };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).toString() };
      }
   });

   // NL -> SQL. Metadata for retrieved tables is loaded here via the DB client.
   ipcMain.handle('ai:generate-sql', async (event, params: GenerateSqlParams) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const conn = connections[params.uid];
      if (!conn) return { status: 'error', response: 'Connection not found' };

      try {
         const provider = createProvider(params.provider);
         const rankedRefs = await retrieve(params, provider);
         const result = await runNlToSql({
            question: params.question,
            tables: params.tables,
            dialect: params.dialect,
            writeMode: params.writeMode,
            maxTables: params.maxTables,
            vocabulary: params.vocabulary,
            rankedRefs
         }, {
            provider,
            enrich: refs => enrichTables(conn, refs)
         });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).toString() };
      }
   });

   // Answer a question ABOUT the schema in prose, using the same retrieval + metadata
   // enrichment as NL->SQL (so schema chat is as informed as SQL generation).
   ipcMain.handle('ai:ask-schema', async (event, params: AskSchemaParams) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const conn = connections[params.uid];
      if (!conn) return { status: 'error', response: 'Connection not found' };

      try {
         const provider = createProvider(params.provider);
         const rankedRefs = await retrieve(params, provider);
         const enriched = await enrichTables(conn, rankedRefs);
         const messages = buildSchemaAnswerPrompt(params.question, enriched, {
            dialect: params.dialect,
            vocabulary: params.vocabulary,
            history: params.history
         });
         const answer = await provider.chat(messages, { maxTokens: 2048, temperature: 0.3 });
         return { status: 'success', response: { answer, usedTables: enriched.map(t => t.name) } };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).toString() };
      }
   });

   // Free-form chat (metadata context is built by the renderer into messages).
   ipcMain.handle('ai:chat', async (event, params: ChatParams) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      try {
         const provider = createProvider(params.provider);
         const reply = await provider.chat(params.messages, { maxTokens: 2048, temperature: 0.3 });
         return { status: 'success', response: reply };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).toString() };
      }
   });

   // Explain / optimize / fix an existing query.
   ipcMain.handle('ai:explain-sql', async (event, params: ExplainSqlParams) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      try {
         const provider = createProvider(params.provider);
         const mode = params.mode ?? 'explain';
         const instruction = {
            explain: 'Explain what this SQL does, step by step, in plain English.',
            optimize: 'Suggest an optimized version of this SQL and explain the improvements. Return SQL in a ```sql block.',
            fix: 'Find and fix problems in this SQL. Return corrected SQL in a ```sql block with a short explanation.'
         }[mode];
         const reply = await provider.chat([
            { role: 'system', content: `You are a senior DBA. Dialect: ${params.dialect}.` },
            { role: 'user', content: `${instruction}\n\n\`\`\`sql\n${params.sql}\n\`\`\`` }
         ], { maxTokens: 1500, temperature: 0.2 });
         return { status: 'success', response: reply };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).toString() };
      }
   });
};
