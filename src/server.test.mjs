import { test, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import bcrypt from 'bcrypt';
import { createTestSchema } from '../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;
delete process.env.GEMINI_API_KEY;

const { initDb, pool, query } = await import('./db/database.js');
const app = (await import('./app.js')).default;

after(async () => {
  await pool.end();
  await drop();
});

test('Server API and Page tests', async (t) => {
  await initDb();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const getCookie = async (email = 'student@example.com', password = 'password123') => {
    const res = await fetch(`http://localhost:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.headers.get('set-cookie');
  };

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
    const wsRes = await query('SELECT id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
    const countBeforeRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countBefore = countBeforeRes.rows[0].count;

    const res = await fetch(`http://localhost:${port}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workstationId: ws.id, date: '2026-11-04', slot: 0 })
    });
    assert.strictEqual(res.status, 401);

    const countAfterRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countAfter = countAfterRes.rows[0].count;
    assert.strictEqual(countAfter, countBefore);
  });

  await t.test('AC-1 A signed-in student who chooses a weekday on the booking screen sees six 2-hour slots from 08:00 to 20:00 for each workstation, each marked free or booked', async () => {
    const cookie = await getCookie();
    const labRes = await query('SELECT id FROM labs LIMIT 1');
    const lab = labRes.rows[0];

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

  await t.test('AC-2 A student who presses Book on a free slot sees that slot change to their own booking with a Cancel button, the API answers 201, and a new row with their user id appears in the bookings table', async () => {
    const cookie = await getCookie();
    const wsRes = await query('SELECT id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
    const countBeforeRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countBefore = countBeforeRes.rows[0].count;

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

    const countAfterRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countAfter = countAfterRes.rows[0].count;
    assert.strictEqual(countAfter, countBefore + 1);

    const bookingRowRes = await query('SELECT * FROM bookings WHERE id = $1', [data.id]);
    const bookingRow = bookingRowRes.rows[0];
    assert.ok(bookingRow);
    assert.strictEqual(bookingRow.workstation_id, ws.id);
    assert.strictEqual(bookingRow.slot, 2);
  });

  await t.test('AC-3 A student who tries to book a slot that another student has already booked sees "This slot is already booked", the API answers 409, and no new row appears in bookings', async () => {
    const cookie = await getCookie();
    const wsRes = await query('SELECT id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
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

    const countBeforeRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countBefore = countBeforeRes.rows[0].count;

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

    const countAfterRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countAfter = countAfterRes.rows[0].count;
    assert.strictEqual(countAfter, countBefore);
  });

  await t.test('AC-8 A booking request for a Saturday, or for a slot that starts at or after 20:00, gets 422 from the API, and no new row appears in bookings', async () => {
    const cookie = await getCookie();
    const wsRes = await query('SELECT id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
    const countBeforeRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countBefore = countBeforeRes.rows[0].count;

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

    const countAfterRes = await query('SELECT COUNT(*)::int AS count FROM bookings');
    const countAfter = countAfterRes.rows[0].count;
    assert.strictEqual(countAfter, countBefore);
  });

  await t.test('AC-4 A student who cancels their own booking gets 204, sees the slot marked Free again, and the row is gone from bookings', async () => {
    const cookie = await getCookie();
    const wsRes = await query('SELECT id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
    const date = '2026-11-03';
    const slot = 3;

    // Create booking
    const bookRes = await fetch(`http://localhost:${port}/api/bookings`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workstationId: ws.id, date, slot })
    });
    const booking = await bookRes.json();
    assert.strictEqual(bookRes.status, 201);

    // Cancel booking
    const cancelRes = await fetch(`http://localhost:${port}/api/bookings/${booking.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.strictEqual(cancelRes.status, 204);

    // Verify row is gone
    const rowRes = await query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
    const row = rowRes.rows[0];
    assert.strictEqual(row, undefined);
  });

  await t.test('AC-5 A student who sends a cancel request to the API for another student\'s booking gets 403, and the row stays in bookings', async () => {
    const cookie1 = await getCookie();
    const wsRes = await query('SELECT id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
    const date = '2026-11-03';
    const slot = 4;

    // Create booking as student 1
    const bookRes = await fetch(`http://localhost:${port}/api/bookings`, {
      method: 'POST',
      headers: {
        Cookie: cookie1,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workstationId: ws.id, date, slot })
    });
    const booking = await bookRes.json();

    // Create student 2 in test database
    const hash = await bcrypt.hash('password123', 10);
    await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [
      'student2@example.com',
      hash,
      'student'
    ]);
    const cookie2 = await getCookie('student2@example.com', 'password123');

    // Student 2 tries to cancel student 1's booking
    const cancelRes = await fetch(`http://localhost:${port}/api/bookings/${booking.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie2 }
    });
    assert.strictEqual(cancelRes.status, 403);

    // Verify row is still in bookings
    const rowRes = await query('SELECT * FROM bookings WHERE id = $1', [booking.id]);
    const row = rowRes.rows[0];
    assert.ok(row);
  });

  await t.test('Cancellation without session gives 401 and non-existent booking gives 404', async () => {
    const res401 = await fetch(`http://localhost:${port}/api/bookings/999999`, {
      method: 'DELETE'
    });
    assert.strictEqual(res401.status, 401);

    const cookie = await getCookie();
    const res404 = await fetch(`http://localhost:${port}/api/bookings/999999`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.strictEqual(res404.status, 404);
  });

  await t.test('AC-16 Search via API with no GEMINI_API_KEY returns fallback message and 200', async () => {
    const cookie = await getCookie();
    const res = await fetch(`http://localhost:${port}/api/search`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sentence: 'tomorrow at 10 in lab 1' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.message, 'Could not understand the request, please choose the day and time yourself');
  });

  await t.test('Search via API without a session gives 401', async () => {
    const res = await fetch(`http://localhost:${port}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence: 'tomorrow at 10 in lab 1' })
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('Search via API with an empty sentence gives 422', async () => {
    const cookie = await getCookie();
    const res = await fetch(`http://localhost:${port}/api/search`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sentence: '' })
    });
    assert.strictEqual(res.status, 422);

    const resMissing = await fetch(`http://localhost:${port}/api/search`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    assert.strictEqual(resMissing.status, 422);
  });

  await t.test('AC-6 After lab staff add a new workstation to a lab, a student who opens that lab\'s booking screen sees the new workstation with six "Free" slots', async () => {
    const staffCookie = await getCookie('staff@example.com', 'admin123');
    const labRes = await query('SELECT id FROM labs LIMIT 1');
    const lab = labRes.rows[0];
    const wsName = 'TestWS_' + Date.now();
    const addRes = await fetch(`http://localhost:${port}/api/labs/${lab.id}/workstations`, {
      method: 'POST',
      headers: {
        Cookie: staffCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: wsName })
    });
    assert.strictEqual(addRes.status, 201);

    const studentCookie = await getCookie();
    const slotsRes = await fetch(`http://localhost:${port}/api/labs/${lab.id}/slots?date=2026-11-04`, {
      headers: { Cookie: studentCookie }
    });
    assert.strictEqual(slotsRes.status, 200);
    const workstations = await slotsRes.json();
    const found = workstations.find((w) => w.name === wsName);
    assert.ok(found);
    assert.strictEqual(found.slots.length, 6);
    for (const slot of found.slots) {
      assert.strictEqual(slot.status, 'free');
    }
  });

  await t.test('AC-7 A student who opens the staff page /staff gets 403 and does not see the page content', async () => {
    const studentCookie = await getCookie();
    const res = await fetch(`http://localhost:${port}/staff`, {
      headers: { Cookie: studentCookie }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.text();
    assert.ok(!body.includes('Staff'));
  });

  await t.test('AC-10 Lab staff who choose a week on the usage screen see one row per lab with the number of bookings in that week, and each number matches the count of rows in bookings for that lab and week', async () => {
    const staffCookie = await getCookie('staff@example.com', 'admin123');
    const week = '2026-11-04';
    const res = await fetch(`http://localhost:${port}/api/usage?week=${week}`, {
      headers: { Cookie: staffCookie }
    });
    assert.strictEqual(res.status, 200);
    const usage = await res.json();
    assert.ok(Array.isArray(usage));
    const expectedRes = await query(`
      SELECT l.id, l.name, COUNT(b.id)::int AS booking_count
      FROM labs l
      LEFT JOIN workstations w ON l.id = w.lab_id
      LEFT JOIN bookings b ON w.id = b.workstation_id AND b.date >= '2026-11-02' AND b.date <= '2026-11-08'
      GROUP BY l.id, l.name
      ORDER BY l.id
    `);
    const expected = expectedRes.rows.map((row) => ({ ...row }));
    assert.deepStrictEqual(usage, expected);
  });

  await t.test('AC-27 A student who sends a request to a staff API endpoint, to add a workstation or to read the usage numbers, gets 403, and no row changes in workstations; no session gets 401', async () => {
    const studentCookie = await getCookie();
    const labRes = await query('SELECT id FROM labs LIMIT 1');
    const lab = labRes.rows[0];
    const countBeforeRes = await query('SELECT COUNT(*)::int AS count FROM workstations');
    const countBefore = countBeforeRes.rows[0].count;

    const resWsStudent = await fetch(`http://localhost:${port}/api/labs/${lab.id}/workstations`, {
      method: 'POST',
      headers: {
        Cookie: studentCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'UnauthorizedWS' })
    });
    assert.strictEqual(resWsStudent.status, 403);

    const resUsageStudent = await fetch(`http://localhost:${port}/api/usage?week=2026-11-04`, {
      headers: { Cookie: studentCookie }
    });
    assert.strictEqual(resUsageStudent.status, 403);

    const countAfterRes = await query('SELECT COUNT(*)::int AS count FROM workstations');
    const countAfter = countAfterRes.rows[0].count;
    assert.strictEqual(countAfter, countBefore);

    const resWsNoSession = await fetch(`http://localhost:${port}/api/labs/${lab.id}/workstations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NoSessionWS' })
    });
    assert.strictEqual(resWsNoSession.status, 401);

    const resUsageNoSession = await fetch(`http://localhost:${port}/api/usage?week=2026-11-04`);
    assert.strictEqual(resUsageNoSession.status, 401);
  });

  await t.test('AC-9 a student\'s own booked slot has calendarUrl and someone else\'s does not', async () => {
    const cookie1 = await getCookie();
    const wsRes = await query('SELECT id, lab_id FROM workstations LIMIT 1');
    const ws = wsRes.rows[0];
    const labId = ws.lab_id;
    const date = '2026-11-10';
    const slot = 0;

    await fetch(`http://localhost:${port}/api/bookings`, {
      method: 'POST',
      headers: {
        Cookie: cookie1,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workstationId: ws.id, date, slot })
    });

    const res1 = await fetch(`http://localhost:${port}/api/labs/${labId}/slots?date=${date}`, {
      headers: { Cookie: cookie1 }
    });
    assert.strictEqual(res1.status, 200);
    const workstations1 = await res1.json();
    const ws1 = workstations1.find((w) => w.id === ws.id);
    const slot1 = ws1.slots.find((s) => s.slot === slot);
    assert.strictEqual(slot1.status, 'mine');
    assert.ok(slot1.calendarUrl);
    assert.ok(slot1.calendarUrl.includes('calendar.google.com'));

    const hash = await bcrypt.hash('password123', 10);
    try {
      await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [
        'student_calendar@example.com',
        hash,
        'student'
      ]);
    } catch (e) {}
    const cookie2 = await getCookie('student_calendar@example.com', 'password123');

    const res2 = await fetch(`http://localhost:${port}/api/labs/${labId}/slots?date=${date}`, {
      headers: { Cookie: cookie2 }
    });
    assert.strictEqual(res2.status, 200);
    const workstations2 = await res2.json();
    const ws2 = workstations2.find((w) => w.id === ws.id);
    const slot2 = ws2.slots.find((s) => s.slot === slot);
    assert.strictEqual(slot2.status, 'other');
    assert.strictEqual(slot2.calendarUrl, undefined);
  });

  await t.test('AC-14 after signing in with a seeded account, /api/labs lists every seeded lab with its name and number of workstations', async () => {
    const cookie = await getCookie();
    const res = await fetch(`http://localhost:${port}/api/labs`, { headers: { Cookie: cookie } });
    assert.strictEqual(res.status, 200);
    const labs = await res.json();
    const expectedRes = await query(`
      SELECT l.id, l.name, COUNT(w.id)::int AS workstation_count
      FROM labs l LEFT JOIN workstations w ON w.lab_id = l.id
      GROUP BY l.id ORDER BY l.id
    `);
    const expected = expectedRes.rows.map((l) => ({ ...l }));
    const actual = labs
      .map((l) => ({ id: l.id, name: l.name, workstation_count: l.workstation_count }))
      .sort((a, b) => a.id - b.id);
    assert.ok(expected.length > 0);
    assert.deepStrictEqual(actual, expected);
  });

  await t.test('AC-15 after one lab row is deleted in the database, /api/labs no longer lists that lab', async () => {
    const cookie = await getCookie();
    const labRes = await query('SELECT id FROM labs ORDER BY id DESC LIMIT 1');
    const lab = labRes.rows[0];
    await query('DELETE FROM labs WHERE id = $1', [lab.id]);
    const res = await fetch(`http://localhost:${port}/api/labs`, { headers: { Cookie: cookie } });
    const labs = await res.json();
    assert.ok(labs.length > 0);
    assert.ok(!labs.some((l) => l.id === lab.id));
  });

  await new Promise((resolve) => server.close(resolve));
});
