import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const tmpDb = `/tmp/booking_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../db/database.js');
const { createBooking } = await import('./bookingService.js');
const { BookingConflict, InvalidBooking } = await import('./errors.js');

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
