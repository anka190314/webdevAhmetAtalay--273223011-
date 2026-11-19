import { test, after } from 'node:test';
import assert from 'node:assert';
import { createTestSchema } from '../../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;

const { initDb, pool, query } = await import('../db/database.js');
const { generateToken, resolveToken, createTokenForEmail } = await import('./tokenService.js');

after(async () => {
  await pool.end();
  await drop();
});

test('token service tests', async (t) => {
  await initDb();

  const userRes = await query('SELECT id, email FROM users WHERE role = $1', ['student']);
  const user = userRes.rows[0];

  await t.test('a created token resolves to its user', async () => {
    const token = await generateToken(user.id);
    assert.strictEqual(typeof token, 'string');
    assert.ok(token.length > 0);

    const resolved = await resolveToken(token);
    assert.ok(resolved);
    assert.strictEqual(resolved.id, user.id);
  });

  await t.test('a wrong token and an empty token resolve to null', async () => {
    const wrongResolved = await resolveToken('nonexistenttoken1234567890abcdef');
    assert.strictEqual(wrongResolved, null);

    const emptyResolved1 = await resolveToken('');
    assert.strictEqual(emptyResolved1, null);

    const emptyResolved2 = await resolveToken(null);
    assert.strictEqual(emptyResolved2, null);
  });

  await t.test('the mcp_tokens table holds only the hash, never the token', async () => {
    const token = await generateToken(user.id);
    const rowsRes = await query('SELECT * FROM mcp_tokens');
    const rows = rowsRes.rows;
    assert.ok(rows.length > 0);
    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (typeof val === 'string') {
          assert.strictEqual(val.includes(token), false);
        }
      }
    }
  });

  await t.test('createTokenForEmail creates token for existing email and returns null for non-existing email', async () => {
    const token = await createTokenForEmail(user.email);
    assert.strictEqual(typeof token, 'string');
    assert.ok(token.length > 0);
    const resolved = await resolveToken(token);
    assert.ok(resolved);
    assert.strictEqual(resolved.id, user.id);

    const nullToken = await createTokenForEmail('nonexistent@example.com');
    assert.strictEqual(nullToken, null);
  });
});
