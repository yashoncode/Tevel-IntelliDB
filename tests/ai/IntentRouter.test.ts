import assert from 'node:assert';
import { test } from 'node:test';

import { classifyAiIntent } from '../../src/common/libs/classifyAiIntent';

test('data-retrieval questions route to SQL', () => {
   assert.equal(classifyAiIntent('top 10 customers by total order value this year'), 'sql');
   assert.equal(classifyAiIntent('show me all orders from last month'), 'sql');
   assert.equal(classifyAiIntent('count of orders per customer'), 'sql');
   assert.equal(classifyAiIntent('average invoice amount by region'), 'sql');
});

test('schema questions route to chat', () => {
   assert.equal(classifyAiIntent('how are orders and payments related?'), 'chat');
   assert.equal(classifyAiIntent('which tables reference the users table?'), 'chat');
   assert.equal(classifyAiIntent('explain the schema'), 'chat');
   assert.equal(classifyAiIntent('what columns does the orders table have?'), 'chat');
});

test('"how many / what tables" is a schema question, not a data query', () => {
   assert.equal(classifyAiIntent('how many tables are there?'), 'chat');
   assert.equal(classifyAiIntent('what tables do we have?'), 'chat');
   assert.equal(classifyAiIntent('list all tables'), 'chat');
});

test('bare noun phrases default to SQL', () => {
   assert.equal(classifyAiIntent('customers in London'), 'sql');
});
