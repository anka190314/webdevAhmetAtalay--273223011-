import { test } from 'node:test';
import assert from 'node:assert';

const { pool } = await import('./database.js');

test('an error on an idle database client is logged, not thrown, so a database restart cannot crash the app', () => {
  assert.doesNotThrow(() => pool.emit('error', new Error('simulated: terminating connection due to administrator command')));
});
