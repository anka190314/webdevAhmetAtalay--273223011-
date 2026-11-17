import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const tmpDb = `/tmp/lab_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../db/database.js');
const { addWorkstation, getLabUsage } = await import('./labService.js');
const { NotStaff, InvalidInput, DuplicateWorkstation, LabNotFound } = await import('./errors.js');

test('AC-27 student gets NotStaff from both functions and no workstation row is added', async () => {
  await initDb();

  const student = db.prepare('SELECT * FROM users WHERE role = ?').get('student');
  const lab = db.prepare('SELECT * FROM labs LIMIT 1').get();

  const initialWsCount = db.prepare('SELECT COUNT(*) as count FROM workstations WHERE lab_id = ?').get(lab.id).count;

  await assert.rejects(async () => {
    await addWorkstation(student, lab.id, 'New WS');
  }, (err) => {
    assert.strictEqual(err instanceof NotStaff, true);
    return true;
  });

  const finalWsCount = db.prepare('SELECT COUNT(*) as count FROM workstations WHERE lab_id = ?').get(lab.id).count;
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

  // Ensure there is a staff user (seed data has staff)
  const staff = db.prepare('SELECT * FROM users WHERE role = ?').get('staff');
  const lab = db.prepare('SELECT * FROM labs LIMIT 1').get();
  const otherLab = db.prepare('SELECT * FROM labs WHERE id != ? LIMIT 1').get(lab.id);

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

  const staff = db.prepare('SELECT * FROM users WHERE role = ?').get('staff');
  const student = db.prepare('SELECT * FROM users WHERE role = ?').get('student');

  const labs = db.prepare('SELECT * FROM labs LIMIT 2').all();
  const lab1 = labs[0];
  const lab2 = labs[1];

  const ws1 = db.prepare('SELECT * FROM workstations WHERE lab_id = ? LIMIT 1').get(lab1.id);
  const ws2 = db2 => db.prepare('SELECT * FROM workstations WHERE lab_id = ? LIMIT 1').get(db2);
  const workstation2 = ws2(lab2.id);

  const wednesday = '2026-11-04'; // Wednesday
  const monday = '2026-11-02';    // Monday of that week
  const friday = '2026-11-06';    // Friday of that week
  const fridayBefore = '2026-10-30'; // Friday before
  const mondayAfter = '2026-11-09';  // Monday after

  // Insert bookings directly or via database
  const insertB = (userId, wsId, date, slot) => {
    db.prepare('INSERT INTO bookings (user_id, workstation_id, date, slot) VALUES (?, ?, ?, ?)').run(userId, wsId, date, slot);
  };

  // Counted bookings for lab1
  insertB(student.id, ws1.id, monday, 0);
  insertB(student.id, ws1.id, friday, 1);

  // Uncounted bookings (outside week)
  insertB(student.id, ws1.id, fridayBefore, 0);
  insertB(student.id, ws1.id, mondayAfter, 0);

  // lab2 has 0 bookings in that week (even if it has a booking outside)
  insertB(student.id, workstation2.id, fridayBefore, 1);

  const usage = await getLabUsage(staff, wednesday);

  // Every lab has a row, including one with 0 bookings
  assert.ok(Array.isArray(usage));
  const usageMap = new Map(usage.map((u) => [u.id, u.booking_count]));

  assert.strictEqual(usageMap.get(lab1.id), 2);
  assert.strictEqual(usageMap.get(lab2.id), 0);


  // The same week given by its Monday and by its Sunday gives the same numbers
  for (const day of ['2026-11-02', '2026-11-08']) {
    const same = new Map((await getLabUsage(staff, day)).map((u) => [u.id, u.booking_count]));
    assert.strictEqual(same.get(lab1.id), 2);
    assert.strictEqual(same.get(lab2.id), 0);
  }

  try {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(tmpDb + '-wal')) fs.unlinkSync(tmpDb + '-wal');
    if (fs.existsSync(tmpDb + '-shm')) fs.unlinkSync(tmpDb + '-shm');
  } catch (e) {}
});
