import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const tmpDb = `/tmp/search_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../db/database.js');
const { createSearch } = await import('./search.js');

test('Search Service tests', async (t) => {
  await initDb();

  // Get a valid lab id from seed data
  const lab = db.prepare('SELECT id FROM labs LIMIT 1').get();
  const labId = lab ? lab.id : 1;

  const fallbackMsg = 'Could not understand the request, please choose the day and time yourself';

  await t.test('AC-17 valid search request returns labId, date, slot', async () => {
    const fakeAskModel = async () => JSON.stringify({
      labId: labId,
      date: '2026-11-11', // Wednesday
      slot: 1
    });

    const search = createSearch({
      askModel: fakeAskModel,
      now: () => new Date('2026-11-10T12:00:00Z'),
      timeoutMs: 5000
    });

    process.env.GEMINI_API_KEY = 'test-key';
    const result = await search('tomorrow at 10 in lab');
    assert.deepStrictEqual(result, {
      labId: labId,
      date: '2026-11-11',
      slot: 1
    });
  });

  await t.test('AC-21 unknown lab, weekend, past date, invalid slot or non-json are rejected', async () => {
    const search = createSearch({
      askModel: async () => JSON.stringify({ labId: 99999, date: '2026-11-11', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    process.env.GEMINI_API_KEY = 'test-key';

    // Unknown lab
    let res = await search('unknown lab');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // Weekend (Saturday 2026-11-14)
    const searchWeekend = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11-14', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await searchWeekend('weekend');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // Past date (2026-11-09)
    const searchPast = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11-09', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await searchPast('past');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // Slot out of range (7)
    const searchSlot = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11-11', slot: 7 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await searchSlot('slot 7');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // Non-JSON text
    const searchNonJson = createSearch({
      askModel: async () => 'not json',
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await searchNonJson('nonsense');
    assert.deepStrictEqual(res, { message: fallbackMsg });
  });

  await t.test('AC-22 model timeout returns fallback message', async () => {
    const slowAskModel = async (prompt, { signal } = {}) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(JSON.stringify({ labId: labId, date: '2026-11-11', slot: 1 }));
        }, 200);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        }
      });
    };

    const search = createSearch({
      askModel: slowAskModel,
      now: () => new Date('2026-11-10T12:00:00Z'),
      timeoutMs: 30
    });
    process.env.GEMINI_API_KEY = 'test-key';

    const res = await search('slow request');
    assert.deepStrictEqual(res, { message: fallbackMsg });
  });

  await t.test('AC-16 with no key, askModel is not called and fallback message is returned', async () => {
    let called = false;
    const fakeAskModel = async () => {
      called = true;
      return JSON.stringify({ labId: labId, date: '2026-11-11', slot: 1 });
    };

    const search = createSearch({
      askModel: fakeAskModel,
      now: () => new Date('2026-11-10T12:00:00Z')
    });

    delete process.env.GEMINI_API_KEY;

    const res = await search('no key request');
    assert.strictEqual(called, false);
    assert.deepStrictEqual(res, { message: fallbackMsg });
  });

  try {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(tmpDb + '-wal')) fs.unlinkSync(tmpDb + '-wal');
    if (fs.existsSync(tmpDb + '-shm')) fs.unlinkSync(tmpDb + '-shm');
  } catch (e) {}
});
