import assert from 'node:assert';
import { test } from 'node:test';

import type { AiTable } from '../../src/common/interfaces/ai';
import { extractSql, runNlToSql } from '../../src/main/libs/ai/pipeline/NlToSqlPipeline';
import type { AiProvider } from '../../src/main/libs/ai/providers/AiProvider';

const TABLES = [{ schema: 's', name: 'customers', comment: 'people' }];
const enrich = async (): Promise<AiTable[]> => [{
   schema: 's',
   name: 'customers',
   columns: [{ name: 'id', type: 'int', nullable: false, key: 'pri' }],
   foreignKeys: []
}];

/** Provider that returns queued responses in order. */
function fakeProvider (replies: string[]): AiProvider {
   let i = 0;
   return { chat: async () => replies[Math.min(i++, replies.length - 1)] };
}

test('extractSql pulls SQL out of a fenced block', () => {
   const { sql, explanation } = extractSql('Here you go:\n```sql\nSELECT 1;\n```\nThat lists it.');
   assert.strictEqual(sql, 'SELECT 1;');
   assert.ok(explanation.includes('lists it'));
});

test('extractSql treats bare SQL as the query', () => {
   assert.strictEqual(extractSql('SELECT * FROM t').sql, 'SELECT * FROM t');
});

test('pipeline returns a valid read-only result', async () => {
   const provider = fakeProvider(['```sql\nSELECT * FROM customers\n```\nAll customers.']);
   const result = await runNlToSql(
      { question: 'show customers', tables: TABLES, dialect: 'mysql' },
      { provider, enrich }
   );
   assert.ok(result.valid);
   assert.strictEqual(result.repairAttempts, 0);
   assert.deepStrictEqual(result.usedTables, ['customers']);
});

test('pipeline auto-repairs a blocked statement then succeeds', async () => {
   const provider = fakeProvider([
      '```sql\nDELETE FROM customers\n```', // blocked
      '```sql\nSELECT * FROM customers\n```' // repaired
   ]);
   const result = await runNlToSql(
      { question: 'remove customers', tables: TABLES, dialect: 'mysql' },
      { provider, enrich }
   );
   assert.strictEqual(result.repairAttempts, 1);
   assert.ok(result.valid);
});

test('pipeline reports invalid after exhausting repairs', async () => {
   const provider = fakeProvider(['```sql\nDROP TABLE customers\n```']);
   const result = await runNlToSql(
      { question: 'nuke it', tables: TABLES, dialect: 'mysql' },
      { provider, enrich }
   );
   assert.strictEqual(result.valid, false);
   assert.ok(result.warnings.length > 0);
});
