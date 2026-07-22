import assert from 'node:assert';
import { test } from 'node:test';

import { classifyRisk, splitStatements, stripNoise, validateSql } from '../../src/main/libs/ai/sql/SqlValidator';

test('allows read-only statements', () => {
   assert.ok(validateSql('SELECT * FROM users').valid);
   assert.ok(validateSql('WITH t AS (SELECT 1) SELECT * FROM t').valid);
   assert.ok(validateSql('EXPLAIN SELECT * FROM users').valid);
   assert.ok(validateSql('SHOW TABLES').valid);
   assert.ok(validateSql('DESCRIBE users').valid);
});

test('blocks data/schema mutations in read-only mode', () => {
   for (const sql of [
      'DELETE FROM users',
      'DROP TABLE users',
      'UPDATE users SET x=1',
      'INSERT INTO users VALUES (1)',
      'TRUNCATE users',
      'ALTER TABLE users ADD c INT',
      'CALL do_something()'
   ])
      assert.strictEqual(validateSql(sql).valid, false, `should block: ${sql}`);
});

test('blocks writes hidden inside a CTE (WITH ... DELETE)', () => {
   assert.strictEqual(validateSql('WITH x AS (SELECT 1) DELETE FROM users').valid, false);
});

test('blocks multi-statement injection', () => {
   assert.strictEqual(validateSql('SELECT 1; DROP TABLE users').valid, false);
});

test('blocks EXPLAIN ANALYZE (it executes the query)', () => {
   assert.strictEqual(validateSql('EXPLAIN ANALYZE SELECT * FROM users').valid, false);
   assert.ok(validateSql('EXPLAIN SELECT * FROM users').valid);
});

test('keywords inside comments/strings do not trigger false blocks', () => {
   assert.ok(validateSql('SELECT 1 -- DROP TABLE users').valid);
   assert.ok(validateSql('SELECT \'we will DELETE later\' AS note').valid);
   assert.ok(validateSql('SELECT * FROM t /* UPDATE hint */').valid);
});

test('write mode bypasses the gate', () => {
   assert.ok(validateSql('DELETE FROM users', true).valid);
});

test('empty query is invalid', () => {
   assert.strictEqual(validateSql('').valid, false);
   assert.strictEqual(validateSql('   ').valid, false);
});

test('stripNoise removes comments and string bodies', () => {
   assert.ok(!stripNoise('SELECT \'DROP\' -- DELETE').includes('DROP'));
   assert.ok(!stripNoise('SELECT \'DROP\' -- DELETE').includes('DELETE'));
});

test('splitStatements ignores semicolons inside strings', () => {
   assert.deepStrictEqual(splitStatements('SELECT \';\' ; SELECT 2'), ['SELECT \'\'', 'SELECT 2']);
});

test('classifyRisk: read-only is safe', () => {
   assert.strictEqual(classifyRisk('SELECT * FROM users').level, 'safe');
   assert.strictEqual(classifyRisk('EXPLAIN SELECT 1').level, 'safe');
});

test('classifyRisk: scoped writes are moderate', () => {
   assert.strictEqual(classifyRisk('UPDATE users SET x=1 WHERE id=5').level, 'moderate');
   assert.strictEqual(classifyRisk('DELETE FROM users WHERE id=5').level, 'moderate');
   assert.strictEqual(classifyRisk('INSERT INTO users VALUES (1)').level, 'moderate');
});

test('classifyRisk: unscoped UPDATE/DELETE and DDL are high', () => {
   assert.strictEqual(classifyRisk('UPDATE users SET x=1').level, 'high');
   assert.strictEqual(classifyRisk('DELETE FROM users').level, 'high');
   assert.strictEqual(classifyRisk('DROP TABLE users').level, 'high');
   assert.strictEqual(classifyRisk('TRUNCATE users').level, 'high');
});

test('classifyRisk: takes the highest risk across statements', () => {
   assert.strictEqual(classifyRisk('SELECT 1; DROP TABLE users').level, 'high');
   assert.strictEqual(classifyRisk('INSERT INTO a VALUES (1); UPDATE b SET x=1').level, 'high');
});

test('validateSql exposes risk even in write mode', () => {
   const r = validateSql('DROP TABLE users', true);
   assert.ok(r.valid);
   assert.strictEqual(r.risk, 'high');
});
