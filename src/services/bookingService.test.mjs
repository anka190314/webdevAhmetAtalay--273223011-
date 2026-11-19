import { test, after } from 'node:test';
import assert from 'node:assert';
import { createTestSchema } from '../../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;

const { initDb, pool, query } = await import('../db/database.js');
const { createBooking, getUpcomingBookingsForUser, getLab, getWorkstationSlots, cancelBooking } = await import('./bookingService.js');
const { BookingConflict, InvalidBooking, LabNotFound, WorkstationNotFound, BookingNotFound, NotOwner } = await import('./errors.js');

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

test('bookingService additional coverage tests', async (t) => {
  await initDb();

  const userRes = await query('SELECT id FROM users WHERE role = $1', ['student']);
  const user = userRes.rows[0];

  const user2Res = await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', ['student_cancel@example.com', 'x', 'student']);
  const user2Id = user2Res.rows[0].id;

  const wsRes = await query('SELECT id, lab_id FROM workstations LIMIT 1');
  const ws = wsRes.rows[0];

  const validDate = '2026-11-04'; // Wednesday

  await t.test('getLab successfully returns lab when lab exists', async () => {
    const lab = await getLab(ws.lab_id);
    assert.ok(lab);
    assert.strictEqual(lab.id, ws.lab_id);
  });

  await t.test('getLab throws LabNotFound when lab does not exist', async () => {
    await assert.rejects(async () => {
      await getLab(99999);
    }, (err) => {
      assert.strictEqual(err instanceof LabNotFound, true);
      return true;
    });
  });

  await t.test('createBooking throws InvalidBooking for invalid slot types/values', async () => {
    for (const invalidSlot of [-1, 1.5, '0', null]) {
      await assert.rejects(async () => {
        await createBooking(user.id, ws.id, validDate, invalidSlot);
      }, (err) => {
        assert.strictEqual(err instanceof InvalidBooking, true);
        return true;
      });
    }
  });

  await t.test('cancelBooking successfully cancels booking', async () => {
    const booking = await createBooking(user.id, ws.id, validDate, 3);
    await cancelBooking(user.id, booking.id);
    const upcoming = await getUpcomingBookingsForUser(user.id, validDate);
    assert.strictEqual(upcoming.some((b) => b.id === booking.id), false);
  });

  await t.test('getWorkstationSlots throws InvalidBooking for invalid dates', async () => {
    for (const invalidDate of [null, 123, '2026-11', '2026-02-31']) {
      await assert.rejects(async () => {
        await getWorkstationSlots(ws.lab_id, invalidDate, user.id);
      }, (err) => {
        assert.strictEqual(err instanceof InvalidBooking, true);
        return true;
      });
    }
  });

  await t.test('createBooking throws WorkstationNotFound when workstation does not exist', async () => {
    await assert.rejects(async () => {
      await createBooking(user.id, 99999, validDate, 0);
    }, (err) => {
      assert.strictEqual(err instanceof WorkstationNotFound, true);
      return true;
    });
  });

  await t.test('cancelBooking throws BookingNotFound when booking does not exist', async () => {
    await assert.rejects(async () => {
      await cancelBooking(user.id, 99999);
    }, (err) => {
      assert.strictEqual(err instanceof BookingNotFound, true);
      return true;
    });
  });

  await t.test('getWorkstationSlots throws LabNotFound when lab does not exist', async () => {
    await assert.rejects(async () => {
      await getWorkstationSlots(99999, validDate, user.id);
    }, (err) => {
      assert.strictEqual(err instanceof LabNotFound, true);
      return true;
    });
  });

  await t.test('getUpcomingBookingsForUser without a date uses today: a booking in 2030 is listed, one in 2025 is not', async () => {
    const future = await createBooking(user.id, ws.id, '2030-01-02', 4);
    await query('INSERT INTO bookings (user_id, workstation_id, date, slot) VALUES ($1, $2, $3, $4)', [user.id, ws.id, '2025-01-02', 4]);
    const bookings = await getUpcomingBookingsForUser(user.id);
    assert.ok(bookings.some((b) => b.date === '2030-01-02' && b.slot === 4));
    assert.strictEqual(bookings.some((b) => b.date === '2025-01-02'), false);
    await cancelBooking(user.id, future.id);
  });

  await t.test('cancelBooking by another student throws NotOwner and the booking stays', async () => {
    const booking = await createBooking(user.id, ws.id, validDate, 2);
    await assert.rejects(() => cancelBooking(user2Id, booking.id), (err) => err instanceof NotOwner);
    const mine = await getUpcomingBookingsForUser(user.id, validDate);
    assert.ok(mine.some((b) => b.date === validDate && b.slot === 2));
    await cancelBooking(user.id, booking.id);
  });

  await t.test('getWorkstationSlots successfully returns slots for valid date', async () => {
    const slots = await getWorkstationSlots(ws.lab_id, validDate, user.id);
    assert.ok(Array.isArray(slots));
    assert.ok(slots.length > 0);
    assert.ok(Array.isArray(slots[0].slots));
  });
});
