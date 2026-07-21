import assert from 'node:assert';
import { test } from 'node:test';

import {
   expandTerms, humanizeName, splitIdentifier
} from '../../src/main/libs/ai/schema-intelligence/BusinessVocabulary';
import { RelationshipGraph } from '../../src/main/libs/ai/schema-intelligence/RelationshipGraph';
import {
   buildTableSnapshot, findSuspiciousKeys, toAiColumn, toAiForeignKeys
} from '../../src/main/libs/ai/schema-intelligence/SchemaSnapshot';
import { rankTables } from '../../src/main/libs/ai/schema-intelligence/TableRanker';

// --- BusinessVocabulary ---
test('humanizeName expands abbreviations and strips noise', () => {
   assert.strictEqual(humanizeName('tbl_cust_hdr'), 'customer header');
   assert.strictEqual(humanizeName('invMst'), 'invoice master');
   assert.strictEqual(humanizeName('vw_ord_dtl'), 'order detail');
});

test('splitIdentifier handles snake and camel case', () => {
   assert.deepStrictEqual(splitIdentifier('tbl_cust_hdr'), ['tbl', 'cust', 'hdr']);
   assert.deepStrictEqual(splitIdentifier('invoiceMaster'), ['invoice', 'master']);
});

test('expandTerms includes original and expanded words', () => {
   const terms = expandTerms('tbl_cust_hdr');
   assert.ok(terms.has('cust'));
   assert.ok(terms.has('customer'));
});

test('custom vocabulary overrides defaults', () => {
   assert.strictEqual(humanizeName('acme_wgt', { wgt: 'widget', acme: '' }), 'widget');
});

// --- TableRanker ---
const TABLES = [
   { schema: 'shop', name: 'tbl_cust_hdr', comment: 'customer master' },
   { schema: 'shop', name: 'tbl_ord_hdr' },
   { schema: 'shop', name: 'tbl_inv_hdr' },
   { schema: 'shop', name: 'audit_log' }
];

test('ranker surfaces the customer table for a customer question', () => {
   const ranked = rankTables('list all customers by name', TABLES);
   assert.strictEqual(ranked[0].ref.name, 'tbl_cust_hdr');
});

test('ranker respects the limit', () => {
   assert.strictEqual(rankTables('customers orders invoices', TABLES, {}, 2).length, 2);
});

test('ranker falls back to first N when nothing matches', () => {
   const ranked = rankTables('xyzzy', TABLES, {}, 2);
   assert.strictEqual(ranked.length, 2);
});

// --- RelationshipGraph ---
const GRAPH_TABLES = [
   { schema: 's', name: 'orders', foreignKeys: [{ field: 'customer_id', refTable: 'customers', refField: 'id' }] },
   { schema: 's', name: 'invoices', foreignKeys: [{ field: 'order_id', refTable: 'orders', refField: 'id' }] },
   { schema: 's', name: 'customers', foreignKeys: [] }
];

test('joinPath finds a multi-hop path', () => {
   const g = new RelationshipGraph(GRAPH_TABLES);
   const path = g.joinPath('customers', 'invoices');
   assert.strictEqual(path.length, 2);
   assert.strictEqual(path[0].toTable, 'orders');
   assert.strictEqual(path[1].toTable, 'invoices');
});

test('joinPath returns empty for unrelated / same table', () => {
   const g = new RelationshipGraph(GRAPH_TABLES);
   assert.deepStrictEqual(g.joinPath('customers', 'customers'), []);
});

// --- SchemaSnapshot: the no-row-data boundary ---
test('toAiColumn whitelists metadata and drops unexpected fields', () => {
   const dirty = { name: 'email', type: 'varchar', nullable: false, key: 'uni',
      // fields a leak might carry — must NOT survive:
      sampleValue: 'alice@example.com', data: ['row1', 'row2'] } as never;
   const col = toAiColumn(dirty);
   assert.deepStrictEqual(Object.keys(col).sort(), ['comment', 'default', 'key', 'name', 'nullable', 'type']);
   assert.ok(!JSON.stringify(col).includes('alice'));
});

test('buildTableSnapshot produces no row-data keys', () => {
   const snap = buildTableSnapshot(
      { schema: 's', name: 'users' },
      [{ name: 'id', type: 'int', nullable: false, key: 'pri' }] as never,
      [{ field: 'role_id', refTable: 'roles', refField: 'id' }] as never
   );
   assert.deepStrictEqual(findSuspiciousKeys(snap), []);
   assert.strictEqual(snap.columns?.length, 1);
   assert.strictEqual(snap.foreignKeys?.length, 1);
});

test('toAiForeignKeys drops non-FK key usage', () => {
   const fks = toAiForeignKeys([
      { field: 'id', refTable: null, refField: null },
      { field: 'role_id', refTable: 'roles', refField: 'id' }
   ] as never);
   assert.strictEqual(fks.length, 1);
   assert.strictEqual(fks[0].refTable, 'roles');
});
