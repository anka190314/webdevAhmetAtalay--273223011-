import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const tmpDb = `/tmp/booking_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../db/database.js');
const { createBooking, getUpcomingBookingsForUser } = await import('./bookingService.js');
const { BookingConflict, InvalidBooking } = await import('./errors.js');

test('AC-24 my bookings: each student sees only their own bookings from today on', async () => {
  await initDb();

  const student1 = db.prepare('SELECT id FROM users WHERE role = ?').get('student');
  const student2Id = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
    .run('student2@example.com', 'x', 'student').lastInsertRowid;
  const ws = db.prepare('SELECT id, name, lab_id FROM workstations LIMIT 1').get();
  const lab = db.prepare('SELECT name FROM labs WHERE id = ?').get(ws.lab_id);

  const today = '2026-12-01';
  createBooking(student1.id, ws.id, '2026-11-30', 0);
  createBooking(student1.id, ws.id, today, 1);
  createBooking(student1.id, ws.id, '2026-12-02', 0);
  createBooking(student2Id, ws.id, today, 0);

  const mine = getUpcomingBookingsForUser(student1.id, today);
  assert.deepStrictEqual(mine.map((b) => [b.date, b.slot]), [[today, 1], ['2026-12-02', 0]]);
  assert.strictEqual(mine[0].lab_name, lab.name);
  assert.strictEqual(mine[0].workstation_name, ws.name);

  const theirs = getUpcomingBookingsForUser(student2Id, today);
  assert.deepStrictEqual(theirs.map((b) => [b.date, b.slot]), [[today, 0]]);
});

test('AC-3 and AC-8 direct service tests', async (t) => {
  await initDb();

  const user = db.prepare('SELECT id FROM users WHERE role = ?').get('student');
  const ws = db.prepare('SELECT id FROM workstations LIMIT 1').get();

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

  try {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(tmpDb + '-wal')) fs.unlinkSync(tmpDb + '-wal');
    if (fs.existsSync(tmpDb + '-shm')) fs.unlinkSync(tmpDb + '-shm');
  } catch (e) {}
});
