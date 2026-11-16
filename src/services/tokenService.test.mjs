import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const tmpDb = `/tmp/token_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../db/database.js');
const { generateToken, resolveToken } = await import('./tokenService.js');

test('token service tests', async (t) => {
  await initDb();

  const user = db.prepare('SELECT id FROM users WHERE role = ?').get('student');

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
    const rows = db.prepare('SELECT * FROM mcp_tokens').all();
    assert.ok(rows.length > 0);
    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (typeof val === 'string') {
          assert.strictEqual(val.includes(token), false);
        }
      }
    }
  });

  try {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(tmpDb + '-wal')) fs.unlinkSync(tmpDb + '-wal');
    if (fs.existsSync(tmpDb + '-shm')) fs.unlinkSync(tmpDb + '-shm');
  } catch (e) {}
});
