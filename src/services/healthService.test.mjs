import { test } from 'node:test';
import assert from 'node:assert';
import { checkHealth } from './healthService.js';

test('checkHealth returns ok when ping succeeds', async () => {
  const result = await checkHealth(async () => {}, 2000);
  assert.deepStrictEqual(result, { status: 'ok', db: 'ok' });
});

test('checkHealth gives db down when ping rejects', async () => {
  const result = await checkHealth(async () => { throw new Error('DB connection failed'); }, 2000);
  assert.deepStrictEqual(result, { status: 'error', db: 'down' });
});

test('checkHealth gives db down when ping never answers with a short timeout', async () => {
  const slowPing = () => new Promise((resolve) => setTimeout(resolve, 1000));
  const result = await checkHealth(slowPing, 10);
  assert.deepStrictEqual(result, { status: 'error', db: 'down' });
});
