import { test, after } from 'node:test';
import assert from 'node:assert';
import { createTestSchema } from '../../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;

const { initDb, pool, query } = await import('../db/database.js');
const { createSearch } = await import('./search.js');

after(async () => {
  await pool.end();
  await drop();
});

test('Search Service tests', async (t) => {
  await initDb();

  const labRes = await query('SELECT id FROM labs LIMIT 1');
  const lab = labRes.rows[0];
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

  await t.test('defaultAskModel: good answer', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async (url, options) => {
        assert.ok(url.includes('generateContent'));
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(options.headers['x-goog-api-key'], 'fake-gemini-key');
        return {
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: JSON.stringify({ labId: labId, date: '2026-11-11', slot: 1 }) }]
              }
            }]
          })
        };
      };

      const search = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('tomorrow at 10');
      assert.deepStrictEqual(res, { labId: labId, date: '2026-11-11', slot: 1 });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: non-200 answer', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async () => ({
        ok: false,
        status: 500
      });

      const search = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('error status');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: fetch throws', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async () => {
        throw new Error('Network failure');
      };

      const search = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('network fail');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: abort signal is passed on to fetch', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    let receivedSignal = null;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async (url, options) => {
        receivedSignal = options.signal;
        return {
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: JSON.stringify({ labId: labId, date: '2026-11-11', slot: 1 }) }]
              }
            }]
          })
        };
      };

      const search = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      await search('signal test');
      assert.ok(receivedSignal instanceof AbortSignal);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: no text returned from model', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ candidates: [] })
      });

      const search = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('no text');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('search edge cases: non-string raw response, markdown formatting, invalid json, invalid date format, invalid date object', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // 1. Non-string raw response
    let search = createSearch({
      askModel: async () => 12345,
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    let res = await search('non string');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // 2. Markdown json code block
    search = createSearch({
      askModel: async () => '```json\n{"labId": ' + labId + ', "date": "2026-11-11", "slot": 1}\n```',
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('markdown json');
    assert.deepStrictEqual(res, { labId: labId, date: '2026-11-11', slot: 1 });

    // 3. Markdown generic code block
    search = createSearch({
      askModel: async () => '```\n{"labId": ' + labId + ', "date": "2026-11-11", "slot": 1}\n```',
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('markdown code');
    assert.deepStrictEqual(res, { labId: labId, date: '2026-11-11', slot: 1 });

    // 4. Missing required fields in parsed JSON (missing date, missing slot, etc.)
    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId }), // missing date and slot
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('incomplete json');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11-11' }), // missing slot
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('missing slot');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // 5. Date split length !== 3 or NaNs in date parts
    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('bad date format');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: 'abc-11-11', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('year NaN');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-abc-11', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('month NaN');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11-abc', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('day NaN');
    assert.deepStrictEqual(res, { message: fallbackMsg });

    // 6. Invalid date object (e.g. out of range year)
    search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '9999999999-01-01', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    res = await search('invalid date object');
    assert.deepStrictEqual(res, { message: fallbackMsg });
  });

  await t.test('search handles empty, non-string, or whitespace sentence', async () => {
    const search = createSearch({
      askModel: async () => JSON.stringify({ labId: labId, date: '2026-11-11', slot: 1 }),
      now: () => new Date('2026-11-10T12:00:00Z')
    });
    process.env.GEMINI_API_KEY = 'test-key';

    assert.deepStrictEqual(await search(''), { message: fallbackMsg });
    assert.deepStrictEqual(await search(null), { message: fallbackMsg });
    assert.deepStrictEqual(await search('   '), { message: fallbackMsg });
    assert.deepStrictEqual(await search(123), { message: fallbackMsg });
  });

  await t.test('createSearch default arguments and MODEL_NAME env var branches', async () => {
    const originalModelName = process.env.MODEL_NAME;
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-key';
      delete process.env.MODEL_NAME;

      globalThis.fetch = async (url) => {
        assert.ok(url.includes('gemini-3.5-flash-lite'));
        return {
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: JSON.stringify({ labId: labId, date: '2026-11-25', slot: 1 }) }]
              }
            }]
          })
        };
      };

      const search = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('test default model name');
      assert.deepStrictEqual(res, { labId: labId, date: '2026-11-25', slot: 1 });

      process.env.MODEL_NAME = 'custom-gemini-model';
      globalThis.fetch = async (url) => {
        assert.ok(url.includes('custom-gemini-model'));
        return {
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: JSON.stringify({ labId: labId, date: '2026-11-25', slot: 1 }) }]
              }
            }]
          })
        };
      };
      const searchCustom = createSearch({
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const resCustom = await searchCustom('test custom model name');
      assert.deepStrictEqual(resCustom, { labId: labId, date: '2026-11-25', slot: 1 });

    } finally {
      globalThis.fetch = originalFetch;
      if (originalModelName === undefined) {
        delete process.env.MODEL_NAME;
      } else {
        process.env.MODEL_NAME = originalModelName;
      }
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: timeout triggers abort and timeout rejection functions', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async (url, { signal }) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 500);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Aborted by signal'));
            });
          }
        });
      };

      const search = createSearch({
        timeoutMs: 20,
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('timeout test');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: controllerTimer aborts fetch before timeoutPromise', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async (url, { signal }) => {
        return new Promise((resolve, reject) => {
          if (signal?.aborted) {
            return reject(new Error('Aborted'));
          }
          signal?.addEventListener('abort', () => {
            reject(new Error('Aborted'));
          });
        });
      };

      const search = createSearch({
        timeoutMs: 30,
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('controller abort test');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: timeoutPromise fires and rejects with Model timeout', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async () => {
        return new Promise(resolve => setTimeout(resolve, 500));
      };

      const search = createSearch({
        timeoutMs: 10,
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('timeout promise test');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('defaultAskModel: controllerTimer callback executes when fetch respects signal abort', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = 'fake-gemini-key';
      globalThis.fetch = async (url, { signal }) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 500);
          if (signal?.aborted) {
            clearTimeout(timer);
            return reject(new Error('Aborted'));
          }
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        });
      };

      const search = createSearch({
        timeoutMs: 10,
        now: () => new Date('2026-11-10T12:00:00Z')
      });
      const res = await search('controller abort call test');
      assert.deepStrictEqual(res, { message: fallbackMsg });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  await t.test('createSearch without now uses the real current date: 2030 is accepted, 2020 is in the past', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const searchFuture = createSearch({ askModel: async () => JSON.stringify({ labId, date: '2030-01-02', slot: 1 }) });
      assert.deepStrictEqual(await searchFuture('next week'), { labId, date: '2030-01-02', slot: 1 });
      const searchPast = createSearch({ askModel: async () => JSON.stringify({ labId, date: '2020-01-08', slot: 1 }) });
      assert.deepStrictEqual(await searchPast('last week'), { message: fallbackMsg });
    } finally {
      if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
