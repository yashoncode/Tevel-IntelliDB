// Tevel IntelliDB — hybrid retrieval (RAG).
// Blends the deterministic keyword ranker with semantic similarity from cached
// table embeddings. Table docs are embedded once per connection and cached; the
// question is embedded per call. Everything degrades gracefully: if embeddings are
// disabled or the endpoint fails, retrieval falls back to pure keyword ranking.
//
// No native modules, no separate vector DB: vectors live in a small JSON cache and
// cosine similarity runs in-memory — plenty for the few-hundred/few-thousand-table
// case. (See ROADMAP D2.)

import type { AiTableRef } from 'common/interfaces/ai';

import type { AiProvider } from '../providers/AiProvider';
import { humanizeName } from './BusinessVocabulary';
import { RankedTable, scoreTables, tableKey } from './TableRanker';

export function cosineSimilarity (a: number[], b: number[]): number {
   let dot = 0; let na = 0; let nb = 0;
   const len = Math.min(a.length, b.length);
   for (let i = 0; i < len; i++) {
      dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
   }
   if (na === 0 || nb === 0) return 0;
   return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** The text embedded to represent a table: raw name + humanized name + comment. */
export function tableDoc (ref: AiTableRef, vocabulary: Record<string, string> = {}): string {
   const human = humanizeName(ref.name, vocabulary);
   return [ref.name, human && human !== ref.name ? human : '', ref.comment ?? '']
      .filter(Boolean).join(' — ');
}

/** Returns a min-max normalizer to [0,1]; a flat set maps to 0. */
function minMax (values: number[]): (v: number) => number {
   if (!values.length) return () => 0;
   const min = Math.min(...values);
   const max = Math.max(...values);
   const span = max - min;
   return span > 0 ? (v: number) => (v - min) / span : () => 0;
}

/**
 * Blend keyword + semantic scores (each min-max normalized) into a final ranking.
 * When there are no semantic scores this is exactly the keyword order (stable by input
 * order on ties), preserving the ranker-only behaviour.
 */
export function blendRanking (
   keyword: RankedTable[],
   semantic: Map<string, number>,
   limit: number,
   semanticWeight = 0.6
): AiTableRef[] {
   const kwNorm = minMax(keyword.map(k => k.score));
   const semNorm = minMax([...semantic.values()]);
   const useSem = semantic.size > 0;

   return keyword
      .map((k, index) => {
         const kw = kwNorm(k.score);
         const semRaw = semantic.get(tableKey(k.ref));
         const sem = semRaw === undefined ? 0 : semNorm(semRaw);
         const score = useSem ? (1 - semanticWeight) * kw + semanticWeight * sem : kw;
         return { ref: k.ref, score, index };
      })
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .slice(0, limit)
      .map(x => x.ref);
}

export interface VectorCacheEntry { docs: Record<string, string>; vectors: Record<string, number[]> }
export interface VectorCache {
   get (key: string): VectorCacheEntry | null;
   set (key: string, entry: VectorCacheEntry): void;
}

/** Embed table docs (cached, only new/changed ones) + the question, return cosine per table. */
export async function computeSemanticScores (opts: {
   question: string;
   tables: AiTableRef[];
   vocabulary?: Record<string, string>;
   provider: AiProvider;
   cache: VectorCache;
   cacheKey: string;
}): Promise<Map<string, number>> {
   const { question, tables, provider, cache, cacheKey } = opts;
   const vocabulary = opts.vocabulary ?? {};
   const scores = new Map<string, number>();
   if (!provider.embed || tables.length === 0) return scores;

   const docs = new Map<string, string>();
   for (const ref of tables) docs.set(tableKey(ref), tableDoc(ref, vocabulary));

   const cached = cache.get(cacheKey);
   const vectors: Record<string, number[]> = {};
   const staleKeys: string[] = [];
   for (const [key, doc] of docs) {
      if (cached && cached.vectors[key] && cached.docs[key] === doc) vectors[key] = cached.vectors[key];
      else staleKeys.push(key);
   }

   if (staleKeys.length) {
      const embedded = await provider.embed(staleKeys.map(k => docs.get(k) as string), { inputType: 'passage' });
      staleKeys.forEach((k, i) => {
         vectors[k] = embedded[i];
      });
      const mergedDocs: Record<string, string> = {};
      for (const [k, d] of docs) mergedDocs[k] = d;
      cache.set(cacheKey, { docs: mergedDocs, vectors });
   }

   const [qVec] = await provider.embed([question], { inputType: 'query' });
   for (const ref of tables) {
      const v = vectors[tableKey(ref)];
      if (v) scores.set(tableKey(ref), cosineSimilarity(qVec, v));
   }
   return scores;
}

/**
 * Hybrid retrieval entry point. Always returns a ranked, limited list of table refs.
 * Uses embeddings when enabled + available; otherwise (or on any embedding error)
 * falls back to keyword ranking so the pipeline never breaks.
 */
export async function retrieveRankedRefs (opts: {
   question: string;
   tables: AiTableRef[];
   vocabulary?: Record<string, string>;
   limit: number;
   provider: AiProvider;
   cache: VectorCache;
   cacheKey: string;
   useEmbeddings: boolean;
   onError?: (err: Error) => void;
}): Promise<AiTableRef[]> {
   const keyword = scoreTables(opts.question, opts.tables, opts.vocabulary);
   let semantic = new Map<string, number>();
   if (opts.useEmbeddings && opts.provider.embed) {
      try {
         semantic = await computeSemanticScores(opts);
      }
      catch (err) {
         opts.onError?.(err as Error);
         semantic = new Map();
      }
   }
   return blendRanking(keyword, semantic, opts.limit);
}
