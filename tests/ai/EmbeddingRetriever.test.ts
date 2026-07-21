import assert from 'node:assert';
import { test } from 'node:test';

import type { AiTableRef } from '../../src/common/interfaces/ai';
import type { AiProvider } from '../../src/main/libs/ai/providers/AiProvider';
import {
   blendRanking, computeSemanticScores, cosineSimilarity, retrieveRankedRefs,
   tableDoc, VectorCache
} from '../../src/main/libs/ai/schema-intelligence/EmbeddingRetriever';
import { scoreTables, tableKey } from '../../src/main/libs/ai/schema-intelligence/TableRanker';

const TABLES: AiTableRef[] = [
   { schema: 'public', name: 'orders' },
   { schema: 'public', name: 'customers' },
   { schema: 'public', name: 'payments' }
];

// Toy embedder: each text maps to presence of three concepts. Deterministic, no network.
const fakeProvider: AiProvider = {
   chat: async () => '',
   embed: async (texts: string[]) => texts.map(t => {
      const l = t.toLowerCase();
      return [l.includes('order') ? 1 : 0, l.includes('customer') ? 1 : 0, l.includes('payment') ? 1 : 0];
   })
};

function memCache (): VectorCache {
   const store = new Map<string, string>();
   return {
      get: key => (store.has(key) ? JSON.parse(store.get(key) as string) : null),
      set: (key, entry) => {
         store.set(key, JSON.stringify(entry));
      }
   };
}

test('cosineSimilarity: identical=1, orthogonal=0, scaled=1', () => {
   assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
   assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
   assert.ok(Math.abs(cosineSimilarity([1, 1], [2, 2]) - 1) < 1e-9);
   assert.equal(cosineSimilarity([0, 0], [1, 1]), 0); // zero vector guards against NaN
});

test('tableDoc includes name and comment', () => {
   const doc = tableDoc({ schema: 'public', name: 'tbl_orders', comment: 'sales orders' });
   assert.ok(doc.includes('tbl_orders'));
   assert.ok(doc.includes('sales orders'));
});

test('blendRanking with no semantic scores preserves keyword order', () => {
   const keyword = scoreTables('orders', TABLES);
   const out = blendRanking(keyword, new Map(), 3);
   assert.equal(out[0].name, 'orders'); // only keyword hit
   assert.equal(out.length, 3);
});

test('semantic scores promote the concept-matching table', async () => {
   const scores = await computeSemanticScores({
      question: 'payment totals',
      tables: TABLES,
      provider: fakeProvider,
      cache: memCache(),
      cacheKey: 'c1'
   });
   // 'payment' question should score payments highest.
   const payments = scores.get(tableKey({ schema: 'public', name: 'payments' })) ?? 0;
   const orders = scores.get(tableKey({ schema: 'public', name: 'orders' })) ?? 0;
   assert.ok(payments > orders);
});

test('retrieveRankedRefs uses embeddings to rank when enabled', async () => {
   const refs = await retrieveRankedRefs({
      question: 'customer records',
      tables: TABLES,
      limit: 3,
      provider: fakeProvider,
      cache: memCache(),
      cacheKey: 'c2',
      useEmbeddings: true
   });
   assert.equal(refs[0].name, 'customers');
});

test('retrieveRankedRefs falls back to keyword ranking on embed failure', async () => {
   let errored = false;
   const brokenProvider: AiProvider = {
      chat: async () => '',
      embed: async () => {
         throw new Error('endpoint down');
      }
   };
   const refs = await retrieveRankedRefs({
      question: 'orders',
      tables: TABLES,
      limit: 3,
      provider: brokenProvider,
      cache: memCache(),
      cacheKey: 'c3',
      useEmbeddings: true,
      onError: () => {
         errored = true;
      }
   });
   assert.ok(errored);
   assert.equal(refs[0].name, 'orders'); // keyword hit still wins
});

test('cached vectors are reused (provider not called again for same docs)', async () => {
   const cache = memCache();
   let embedCalls = 0;
   const countingProvider: AiProvider = {
      chat: async () => '',
      embed: async (texts: string[]) => {
         embedCalls++; return texts.map(() => [1, 0, 0]);
      }
   };
   const opts = { question: 'orders', tables: TABLES, provider: countingProvider, cache, cacheKey: 'c4' };
   await computeSemanticScores(opts);
   const afterFirst = embedCalls;
   await computeSemanticScores(opts);
   // Second run: table docs cached, only the question is embedded again (+1 call).
   assert.equal(embedCalls, afterFirst + 1);
});
