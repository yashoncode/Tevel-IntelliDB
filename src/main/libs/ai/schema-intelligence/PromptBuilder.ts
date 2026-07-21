// Tevel IntelliDB — token-budgeted prompt builder.
// Turns retrieved metadata into a compact schema context + instructions.

import type { AiMessage, AiTable } from 'common/interfaces/ai';

import { humanizeName } from './BusinessVocabulary';

const CHARS_PER_TOKEN = 4; // rough estimate, good enough for budgeting

/** Compact DDL-ish description of one table (metadata only). */
export function describeTable (table: AiTable, vocabulary: Record<string, string> = {}): string {
   const human = humanizeName(table.name, vocabulary);
   const header = `TABLE ${table.name}${human && human !== table.name ? ` -- ${human}` : ''}${table.comment ? ` (${table.comment})` : ''}`;
   const cols = (table.columns ?? []).map(c => {
      const flags = [
         c.key === 'pri' ? 'PK' : '',
         c.key === 'uni' ? 'UNIQUE' : '',
         c.nullable ? '' : 'NOT NULL'
      ].filter(Boolean).join(' ');
      return `  ${c.name} ${c.type}${flags ? ' ' + flags : ''}${c.comment ? ` -- ${c.comment}` : ''}`;
   });
   const fks = (table.foreignKeys ?? []).map(fk =>
      `  FK ${fk.field} -> ${fk.refTable}.${fk.refField}`);
   return [header, ...cols, ...fks].join('\n');
}

export interface BuildPromptOptions {
   dialect: string;
   writeMode: boolean;
   vocabulary?: Record<string, string>;
   tokenBudget?: number;
}

const SYSTEM_BASE = `You are Tevel IntelliDB, a senior database engineer. You translate questions into correct SQL for the user's database using ONLY the schema metadata provided.

Rules:
- Use only the tables and columns given below. Never invent names.
- You are given METADATA ONLY (no row data); do not assume specific values.
- Return the SQL first inside a single \`\`\`sql code block, then a short plain-English explanation.
- Prefer explicit JOINs using the foreign keys shown.`;

const READONLY_RULE = '- Generate READ-ONLY queries (SELECT/WITH/EXPLAIN/SHOW/DESCRIBE) only. Never INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE.';
const WRITE_RULE = '- Write mode is ENABLED: data-modifying statements are permitted, but be conservative and add WHERE clauses.';

/** Build the chat messages for NL -> SQL. Tables are included until the token budget is hit. */
export function buildSqlPrompt (
   question: string,
   tables: AiTable[],
   opts: BuildPromptOptions
): AiMessage[] {
   const budget = opts.tokenBudget ?? 6000;
   const maxChars = budget * CHARS_PER_TOKEN;

   const parts: string[] = [];
   let used = 0;
   let dropped = 0;
   for (const table of tables) {
      const desc = describeTable(table, opts.vocabulary);
      if (used + desc.length > maxChars && parts.length > 0) { dropped++; continue; }
      parts.push(desc);
      used += desc.length;
   }

   const system = [
      SYSTEM_BASE,
      opts.writeMode ? WRITE_RULE : READONLY_RULE,
      `- SQL dialect: ${opts.dialect}.`
   ].join('\n');

   const schemaBlock = parts.length
      ? `Schema (relevant tables):\n\n${parts.join('\n\n')}`
      : 'No schema tables were retrieved; ask the user to select a database.';

   const noticeBlock = dropped > 0
      ? `\n\n(Note: ${dropped} lower-ranked table(s) were omitted to fit the context budget.)`
      : '';

   return [
      { role: 'system', content: system },
      { role: 'user', content: `${schemaBlock}${noticeBlock}\n\nQuestion: ${question}` }
   ];
}

/** A follow-up message asking the model to fix SQL that failed validation/execution. */
export function buildRepairMessage (badSql: string, error: string): AiMessage {
   return {
      role: 'user',
      content: `The previous SQL was rejected:\n\n\`\`\`sql\n${badSql}\n\`\`\`\n\nError: ${error}\n\nReturn corrected SQL that follows all the rules above.`
   };
}
