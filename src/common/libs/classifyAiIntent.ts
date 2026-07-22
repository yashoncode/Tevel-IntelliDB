// Tevel IntelliDB: lightweight intent router for the AI Query tab.
// Decides whether a natural-language message wants generated SQL ('sql') or a prose
// answer about the schema ('chat'). Deterministic + instant (no LLM call). The UI
// exposes an Auto/SQL/Ask override, so this only needs to be right most of the time.

export type AiIntent = 'sql' | 'chat';

const CHAT_SIGNALS = /\b(explain|describe|what is|what are|what does|tell me about|how do|how does|how are|how is|why|relationship|related|structure|schema|purpose of|meaning of|difference between|data type|primary key|foreign key)\b/;
const SQL_SIGNALS = /\b(show|list|get|find|display|fetch|retrieve|select|count|sum|average|avg|total|top|group by|order by|where|between|per|greatest|highest|lowest|most|least|number of|how much)\b/;

export function classifyAiIntent (question: string): AiIntent {
   const q = ` ${question.toLowerCase().trim()} `;

   // "what/which/how many tables|columns|schemas" is a question ABOUT the schema, not a data query.
   if (/\b(how many|what|which|list (the|all)?)\s+(tables?|columns?|schemas?|fields?)\b/.test(q)) return 'chat';

   if (CHAT_SIGNALS.test(q) && !SQL_SIGNALS.test(q)) return 'chat';
   if (SQL_SIGNALS.test(q)) return 'sql';
   if (CHAT_SIGNALS.test(q)) return 'chat';

   // Bare noun phrases ("customers in London") usually mean "show me" → SQL.
   return 'sql';
}
