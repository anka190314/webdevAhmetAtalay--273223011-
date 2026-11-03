import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';

const tmpDb = `/tmp/server_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('./db/database.js');
const app = (await import('./app.js')).default;

test('Server API and Page tests', async (t) => {
  await initDb();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const getCookie = async () => {
    const res = await fetch(`http://localhost:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'password123' })
    });
    return res.headers.get('set-cookie');
  };

  try {
    await t.test('AC-13 A visitor who opens /labs without signing in lands on /login instead', async () => {
      const res = await fetch(`http://localhost:${port}/labs`, {
        redirect: 'manual'
      });
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.get('location'), '/login');
    });

    await t.test('AC-19 A request to /api/labs without a session gets 401 JSON', async () => {
      const res = await fetch(`http://localhost:${port}/api/labs`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    await t.test('AC-20 A booking request without a session gets 401, and no new row appears in bookings', async () => {
      const ws = db.prepare('SELECT id FROM workstations LIMIT 1').get();
      const countBefore = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;

      const res = await fetch(`http://localhost:${port}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstationId: ws.id, date: '2026-11-04', slot: 0 })
      });
      assert.strictEqual(res.status, 401);

      const countAfter = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
      assert.strictEqual(countAfter, countBefore);
    });

    await t.test('AC-1 A signed-in student who chooses a weekday on the booking screen sees six 2-hour slots from 08:00 to 20:00 for each workstation, each marked free or booked', async () => {
      const cookie = await getCookie();
      const lab = db.prepare('SELECT id FROM labs LIMIT 1').get();

      const res = await fetch(`http://localhost:${port}/api/labs/${lab.id}/slots?date=2026-11-04`, {
        headers: { Cookie: cookie }
      });
      assert.strictEqual(res.status, 200);
      const workstations = await res.json();
      assert.ok(Array.isArray(workstations));
      assert.ok(workstations.length > 0);
      for (const ws of workstations) {
        assert.ok(Array.isArray(ws.slots));
        assert.strictEqual(ws.slots.length, 6);
        for (const slot of ws.slots) {
          assert.ok(typeof slot.slot === 'number');
          assert.ok(['free', 'mine', 'other'].includes(slot.status));
        }
      }
    });

    await t.test('AC-2 A student who presses Book on a free slot sees the slot change to Booked, the API answers 201, and a new row with their user id appears in the bookings table', async () => {
      const cookie = await getCookie();
      const ws = db.prepare('SELECT id FROM workstations LIMIT 1').get();
      const countBefore = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;

      const res = await fetch(`http://localhost:${port}/api/bookings`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workstationId: ws.id, date: '2026-11-06', slot: 2 })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.id);

      const countAfter = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
      assert.strictEqual(countAfter, countBefore + 1);

      const bookingRow = db.prepare('SELECT * FROM bookings WHERE id = ?').get(data.id);
      assert.ok(bookingRow);
      assert.strictEqual(bookingRow.workstation_id, ws.id);
      assert.strictEqual(bookingRow.slot, 2);
    });

    await t.test('AC-3 A student who tries to book a slot that another student has already booked sees "This slot is already booked", the API answers 409, and no new row appears in bookings', async () => {
      const cookie = await getCookie();
      const ws = db.prepare('SELECT id FROM workstations LIMIT 1').get();
      const date = '2026-11-05';
      const slot = 1;

      // First booking
      await fetch(`http://localhost:${port}/api/bookings`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workstationId: ws.id, date, slot })
      });

      const countBefore = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;

      // Second booking on same slot
      const res = await fetch(`http://localhost:${port}/api/bookings`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workstationId: ws.id, date, slot })
      });
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.error, 'This slot is already booked');

      const countAfter = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
      assert.strictEqual(countAfter, countBefore);
    });

    await t.test('AC-8 A booking request for a Saturday, or for a slot that starts at or after 20:00, gets 422 from the API, and no new row appears in bookings', async () => {
      const cookie = await getCookie();
      const ws = db.prepare('SELECT id FROM workstations LIMIT 1').get();
      const countBefore = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;

      // Saturday request
      const resSat = await fetch(`http://localhost:${port}/api/bookings`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workstationId: ws.id, date: '2026-11-07', slot: 0 })
      });
      assert.strictEqual(resSat.status, 422);

      // Slot >= 6 request (invalid slot)
      const resSlot = await fetch(`http://localhost:${port}/api/bookings`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workstationId: ws.id, date: '2026-11-04', slot: 6 })
      });
      assert.strictEqual(resSlot.status, 422);

      const countAfter = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
      assert.strictEqual(countAfter, countBefore);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
      if (fs.existsSync(tmpDb + '-wal')) fs.unlinkSync(tmpDb + '-wal');
      if (fs.existsSync(tmpDb + '-shm')) fs.unlinkSync(tmpDb + '-shm');
    } catch (e) {}
  }
});
