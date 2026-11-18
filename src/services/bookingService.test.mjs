import { test, after } from 'node:test';
import assert from 'node:assert';
import { createTestSchema } from '../../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;

const { initDb, pool, query } = await import('../db/database.js');
const { createBooking, getUpcomingBookingsForUser } = await import('./bookingService.js');
const { BookingConflict, InvalidBooking } = await import('./errors.js');

after(async () => {
  await pool.end();
  await drop();
});

test('AC-24 my bookings: each student sees only their own bookings from today on', async () => {
  await initDb();

  const student1Res = await query('SELECT id FROM users WHERE role = $1', ['student']);
  const student1 = student1Res.rows[0];

  const student2Res = await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', ['student2@example.com', 'x', 'student']);
  const student2Id = student2Res.rows[0].id;

  const wsRes = await query('SELECT id, name, lab_id FROM workstations LIMIT 1');
  const ws = wsRes.rows[0];

  const labRes = await query('SELECT name FROM labs WHERE id = $1', [ws.lab_id]);
  const lab = labRes.rows[0];

  const today = '2026-12-01';
  await createBooking(student1.id, ws.id, '2026-11-30', 0);
  await createBooking(student1.id, ws.id, today, 1);
  await createBooking(student1.id, ws.id, '2026-12-02', 0);
  await createBooking(student2Id, ws.id, today, 0);

  const mine = await getUpcomingBookingsForUser(student1.id, today);
  assert.deepStrictEqual(mine.map((b) => [b.date, b.slot]), [[today, 1], ['2026-12-02', 0]]);
  assert.strictEqual(mine[0].lab_name, lab.name);
  assert.strictEqual(mine[0].workstation_name, ws.name);

  const theirs = await getUpcomingBookingsForUser(student2Id, today);
  assert.deepStrictEqual(theirs.map((b) => [b.date, b.slot]), [[today, 0]]);
});

test('AC-3 and AC-8 direct service tests', async (t) => {
  await initDb();

  const userRes = await query('SELECT id FROM users WHERE role = $1', ['student']);
  const user = userRes.rows[0];

  const wsRes = await query('SELECT id FROM workstations LIMIT 1');
  const ws = wsRes.rows[0];

  const wednesday = '2026-11-04';
  const saturday = '2026-11-07';

  await t.test('AC-8 booking on a Saturday throws InvalidBooking', async () => {
    await assert.rejects(async () => {
      await createBooking(user.id, ws.id, saturday, 0);
    }, (err) => {
      assert.strictEqual(err instanceof InvalidBooking, true);
      return true;
    });
  });

  await t.test('AC-8 booking with slot outside 0-5 throws InvalidBooking', async () => {
    await assert.rejects(async () => {
      await createBooking(user.id, ws.id, wednesday, 6);
    }, (err) => {
      assert.strictEqual(err instanceof InvalidBooking, true);
      return true;
    });
  });

  await t.test('AC-3 booking an already booked slot throws BookingConflict', async () => {
    await createBooking(user.id, ws.id, wednesday, 0);

    await assert.rejects(async () => {
      await createBooking(user.id, ws.id, wednesday, 0);
    }, (err) => {
      assert.strictEqual(err instanceof BookingConflict, true);
      return true;
    });
  });
});
