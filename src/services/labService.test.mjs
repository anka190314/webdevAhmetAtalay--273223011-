import { test, after } from 'node:test';
import assert from 'node:assert';
import { createTestSchema } from '../../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;

const { initDb, pool, query } = await import('../db/database.js');
const { addWorkstation, getLabUsage } = await import('./labService.js');
const { NotStaff, InvalidInput, DuplicateWorkstation, LabNotFound } = await import('./errors.js');

after(async () => {
  await pool.end();
  await drop();
});

test('AC-27 student gets NotStaff from both functions and no workstation row is added', async () => {
  await initDb();

  const studentRes = await query('SELECT * FROM users WHERE role = $1', ['student']);
  const student = studentRes.rows[0];

  const labRes = await query('SELECT * FROM labs LIMIT 1');
  const lab = labRes.rows[0];

  const initialWsRes = await query('SELECT COUNT(*)::int as count FROM workstations WHERE lab_id = $1', [lab.id]);
  const initialWsCount = initialWsRes.rows[0].count;

  await assert.rejects(async () => {
    await addWorkstation(student, lab.id, 'New WS');
  }, (err) => {
    assert.strictEqual(err instanceof NotStaff, true);
    return true;
  });

  const finalWsRes = await query('SELECT COUNT(*)::int as count FROM workstations WHERE lab_id = $1', [lab.id]);
  const finalWsCount = finalWsRes.rows[0].count;
  assert.strictEqual(finalWsCount, initialWsCount);

  await assert.rejects(async () => {
    await getLabUsage(student, '2026-11-04');
  }, (err) => {
    assert.strictEqual(err instanceof NotStaff, true);
    return true;
  });
});

test('staff add workstation, duplicate workstation, invalid input, and lab not found', async () => {
  await initDb();

  const staffRes = await query('SELECT * FROM users WHERE role = $1', ['staff']);
  const staff = staffRes.rows[0];

  const labRes = await query('SELECT * FROM labs LIMIT 1');
  const lab = labRes.rows[0];

  const otherLabRes = await query('SELECT * FROM labs WHERE id != $1 LIMIT 1', [lab.id]);
  const otherLab = otherLabRes.rows[0];

  // 1. Staff successfully adds a workstation
  const ws1 = await addWorkstation(staff, lab.id, 'Workstation Alpha');
  assert.ok(ws1);
  assert.strictEqual(ws1.name, 'Workstation Alpha');
  assert.strictEqual(ws1.lab_id, lab.id);

  // 2. Duplicate workstation name in that lab throws DuplicateWorkstation
  await assert.rejects(async () => {
    await addWorkstation(staff, lab.id, 'Workstation Alpha');
  }, (err) => {
    assert.strictEqual(err instanceof DuplicateWorkstation, true);
    return true;
  });

  // (Can add same name in another lab though)
  if (otherLab) {
    const wsOther = await addWorkstation(staff, otherLab.id, 'Workstation Alpha');
    assert.ok(wsOther);
  }

  // 3. Empty name throws InvalidInput
  await assert.rejects(async () => {
    await addWorkstation(staff, lab.id, '   ');
  }, (err) => {
    assert.strictEqual(err instanceof InvalidInput, true);
    return true;
  });

  await assert.rejects(async () => {
    await addWorkstation(staff, lab.id, '');
  }, (err) => {
    assert.strictEqual(err instanceof InvalidInput, true);
    return true;
  });

  // 4. Unknown lab throws LabNotFound
  await assert.rejects(async () => {
    await addWorkstation(staff, 99999, 'Valid Name');
  }, (err) => {
    assert.strictEqual(err instanceof LabNotFound, true);
    return true;
  });
});

test('AC-10 lab usage counting for a week given by its Wednesday', async () => {
  await initDb();

  const staffRes = await query('SELECT * FROM users WHERE role = $1', ['staff']);
  const staff = staffRes.rows[0];

  const studentRes = await query('SELECT * FROM users WHERE role = $1', ['student']);
  const student = studentRes.rows[0];

  const labsRes = await query('SELECT * FROM labs LIMIT 2');
  const labs = labsRes.rows;
  const lab1 = labs[0];
  const lab2 = labs[1];

  const ws1Res = await query('SELECT * FROM workstations WHERE lab_id = $1 LIMIT 1', [lab1.id]);
  const ws1 = ws1Res.rows[0];

  const workstation2Res = await query('SELECT * FROM workstations WHERE lab_id = $1 LIMIT 1', [lab2.id]);
  const workstation2 = workstation2Res.rows[0];

  const wednesday = '2026-11-04'; // Wednesday
  const monday = '2026-11-02';    // Monday of that week
  const friday = '2026-11-06';    // Friday of that week
  const fridayBefore = '2026-10-30'; // Friday before
  const mondayAfter = '2026-11-09';  // Monday after

  const insertB = async (userId, wsId, date, slot) => {
    await query('INSERT INTO bookings (user_id, workstation_id, date, slot) VALUES ($1, $2, $3, $4)', [userId, wsId, date, slot]);
  };

  // Counted bookings for lab1
  await insertB(student.id, ws1.id, monday, 0);
  await insertB(student.id, ws1.id, friday, 1);

  // Uncounted bookings (outside week)
  await insertB(student.id, ws1.id, fridayBefore, 0);
  await insertB(student.id, ws1.id, mondayAfter, 0);

  // lab2 has 0 bookings in that week (even if it has a booking outside)
  await insertB(student.id, workstation2.id, fridayBefore, 1);

  const usage = await getLabUsage(staff, wednesday);

  assert.ok(Array.isArray(usage));
  const usageMap = new Map(usage.map((u) => [u.id, u.booking_count]));

  assert.strictEqual(usageMap.get(lab1.id), 2);
  assert.strictEqual(usageMap.get(lab2.id), 0);

  for (const day of ['2026-11-02', '2026-11-08']) {
    const same = new Map((await getLabUsage(staff, day)).map((u) => [u.id, u.booking_count]));
    assert.strictEqual(same.get(lab1.id), 2);
    assert.strictEqual(same.get(lab2.id), 0);
  }
});
