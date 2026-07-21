// Tevel IntelliDB — NL -> SQL pipeline.
// retrieve (rank) -> enrich (metadata only) -> prompt -> LLM -> validate -> repair -> preview.
// Decoupled from Electron: the caller passes an `enrich` fn that loads column/FK metadata
// for the retrieved tables (in production, via the DB client; in tests, a stub).

import type {
   AiTable, AiTableRef, GenerateSqlResult
} from 'common/interfaces/ai';

import type { AiProvider } from '../providers/AiProvider';
import { buildRepairMessage, buildSqlPrompt } from '../schema-intelligence/PromptBuilder';
import { rankTables } from '../schema-intelligence/TableRanker';
import { validateSql } from '../sql/SqlValidator';

const MAX_REPAIRS = 2;

/** Pull the SQL out of an LLM markdown reply; the rest is the explanation. */
export function extractSql (response: string): { sql: string; explanation: string } {
   const fenced = response.match(/```(?:sql)?\s*([\s\S]*?)```/i);
   if (fenced) {
      const sql = fenced[1].trim();
      const explanation = response.replace(fenced[0], '').trim();
      return { sql, explanation };
   }
   // No code fence: if it smells like SQL, treat the whole thing as SQL.
   if (/^\s*(select|with|explain|show|describe|insert|update|delete|create)\b/i.test(response))
      return { sql: response.trim(), explanation: '' };

   return { sql: '', explanation: response.trim() };
}

export interface PipelineDeps {
   provider: AiProvider;
   /** Load full metadata (columns + FKs) for the retrieved tables. Metadata only. */
   enrich: (refs: AiTableRef[]) => Promise<AiTable[]>;
}

export interface PipelineInput {
   question: string;
   tables: AiTableRef[];
   dialect: string;
   writeMode?: boolean;
   maxTables?: number;
   vocabulary?: Record<string, string>;
   /** Pre-ranked table refs (e.g. from hybrid RAG). Skips the internal keyword ranker. */
   rankedRefs?: AiTableRef[];
}

export async function runNlToSql (input: PipelineInput, deps: PipelineDeps): Promise<GenerateSqlResult> {
   const { provider, enrich } = deps;
   const writeMode = !!input.writeMode;
   const vocabulary = input.vocabulary ?? {};

   const rankedRefs = input.rankedRefs ??
      rankTables(input.question, input.tables, vocabulary, input.maxTables ?? 12).map(r => r.ref);
   const enriched = await enrich(rankedRefs);
   const usedTables = enriched.map(t => t.name);

   const messages = buildSqlPrompt(input.question, enriched, {
      dialect: input.dialect,
      writeMode,
      vocabulary
   });

   let response = await provider.chat(messages);
   let { sql, explanation } = extractSql(response);
   let validation = validateSql(sql, writeMode);
   let repairAttempts = 0;

   while (!validation.valid && sql && repairAttempts < MAX_REPAIRS) {
      repairAttempts++;
      messages.push({ role: 'assistant', content: response });
      messages.push(buildRepairMessage(sql, validation.warnings.join(' ')));
      response = await provider.chat(messages);
      ({ sql, explanation } = extractSql(response));
      validation = validateSql(sql, writeMode);
   }

   return {
      sql,
      explanation,
      usedTables,
      valid: validation.valid,
      warnings: validation.warnings,
      repairAttempts
   };
}
