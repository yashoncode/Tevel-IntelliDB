// Tevel IntelliDB — deterministic table ranker (the default retriever).
// Scores tables against the NL question by name/comment/vocabulary overlap.
// No embeddings, no network, <1ms for hundreds of tables. Embeddings are a later,
// flag-gated add for very large schemas (see ROADMAP T2.7).

import type { AiTableRef } from 'common/interfaces/ai';

import { expandTerms, humanizeName } from './BusinessVocabulary';

const STOPWORDS = new Set([
   'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'me',
   'show', 'list', 'get', 'find', 'all', 'how', 'many', 'much', 'what', 'which',
   'give', 'with', 'by', 'per', 'each', 'from', 'where', 'that', 'this', 'their',
   'i', 'we', 'my', 'our', 'total', 'count', 'number'
]);

export interface RankedTable {
   ref: AiTableRef;
   score: number;
}

/** Extract meaningful lowercase terms from the user's question. */
export function questionTerms (question: string): string[] {
   return (question.toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Rank tables by relevance to the question. Returns the top `limit`, highest first.
 * Ties keep original order (stable).
 */
export function rankTables (
   question: string,
   tables: AiTableRef[],
   vocabulary: Record<string, string> = {},
   limit = 12
): RankedTable[] {
   const qTerms = questionTerms(question);
   if (qTerms.length === 0) {
      return tables.slice(0, limit).map(ref => ({ ref, score: 0 }));
   }
   const qSet = new Set(qTerms);

   const scored: RankedTable[] = tables.map((ref, index) => {
      const nameTerms = expandTerms(ref.name, vocabulary);
      const commentTerms = ref.comment
         ? new Set((ref.comment.toLowerCase().match(/[a-z0-9]+/g) ?? []))
         : new Set<string>();

      let score = 0;
      for (const q of qSet) {
         if (nameTerms.has(q)) score += 3; // name match is strongest signal
         else if (commentTerms.has(q)) score += 1;
         else {
            // partial / plural tolerance (customer ~ customers)
            for (const n of nameTerms) {
               if (n.length > 3 && (n.startsWith(q) || q.startsWith(n))) { score += 1; break; }
            }
         }
      }
      // whole humanized phrase appearing in the question is a strong hit
      const human = humanizeName(ref.name, vocabulary);
      if (human && question.toLowerCase().includes(human)) score += 2;

      return { ref, score, index };
   })
      .sort((a, b) => (b.score - a.score) || ((a as { index: number }).index - (b as { index: number }).index))
      .map(({ ref, score }) => ({ ref, score }));

   const hits = scored.filter(s => s.score > 0);
   // If nothing matched, fall back to the first N tables so the pipeline still runs.
   return (hits.length ? hits : scored).slice(0, limit);
}
