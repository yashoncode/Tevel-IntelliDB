import * as antares from 'common/interfaces/antares';
import {
   ChatParams, ExplainSqlParams, GenerateSqlParams, RawColumnMeta, RawKeyUsageMeta
} from 'common/interfaces/ai';
import { ipcMain } from 'electron';

import { createProvider } from '../libs/ai/providers/AiProvider';
import { buildTableSnapshot } from '../libs/ai/schema-intelligence/SchemaSnapshot';
import { runNlToSql } from '../libs/ai/pipeline/NlToSqlPipeline';
import { validateSql } from '../libs/ai/sql/SqlValidator';
import { validateSender } from '../libs/misc/validateSender';

export default (connections: Record<string, antares.Client>) => {
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
   // We NEVER call getTableData / row-returning methods — only metadata.
   ipcMain.handle('ai:generate-sql', async (event, params: GenerateSqlParams) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const conn = connections[params.uid];
      if (!conn) return { status: 'error', response: 'Connection not found' };

      try {
         const provider = createProvider(params.provider);
         const result = await runNlToSql({
            question: params.question,
            tables: params.tables,
            dialect: params.dialect,
            writeMode: params.writeMode,
            maxTables: params.maxTables,
            vocabulary: params.vocabulary
         }, {
            provider,
            enrich: async (refs) => {
               const out = [];
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
         });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).toString() };
      }
   });

   // Free-form schema chat (metadata context is built by the renderer into messages).
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

   // Expose validation to the renderer so the UI can gate the Execute button too.
   ipcMain.handle('ai:validate-sql', async (event, params: { sql: string; writeMode?: boolean }) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      return { status: 'success', response: validateSql(params.sql, params.writeMode) };
   });
};
