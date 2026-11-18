import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const tmpDb = `/tmp/auth_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../db/database.js');
const { findOrCreateGoogleUser } = await import('./authService.js');
const { EmailNotVerified } = await import('./errors.js');

test('AC-11 Google auth and linking', async () => {
  await initDb();

  const seededStudent = db.prepare('SELECT * FROM users WHERE role = ?').get('student');
  assert.ok(seededStudent, 'Seeded student exists');
  const initialCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  // 1. Seeded student signs in with Google with the same e-mail and gets the same id, and the users count does not change
  const user1 = await findOrCreateGoogleUser({
    sub: 'google-sub-123',
    email: seededStudent.email,
    emailVerified: true
  });
  assert.strictEqual(user1.id, seededStudent.id);
  const countAfter1 = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  assert.strictEqual(countAfter1, initialCount);

  // 2. A second call with the same sub returns the same user
  const user2 = await findOrCreateGoogleUser({
    sub: 'google-sub-123',
    email: seededStudent.email,
    emailVerified: true
  });
  assert.strictEqual(user2.id, seededStudent.id);
  const countAfter2 = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  assert.strictEqual(countAfter2, initialCount);

  // 3. An unverified e-mail throws EmailNotVerified and nothing is linked
  const unverifiedEmail = 'unverified@example.com';
  await assert.rejects(async () => {
    await findOrCreateGoogleUser({
      sub: 'google-sub-unverified',
      email: unverifiedEmail,
      emailVerified: false
    });
  }, (err) => {
    assert.strictEqual(err instanceof EmailNotVerified, true);
    return true;
  });
  const unlinkedUser = db.prepare('SELECT * FROM users WHERE email = ?').get(unverifiedEmail);
  assert.strictEqual(unlinkedUser, undefined);

  // 4. A new e-mail creates exactly one student
  const newEmail = 'newstudent@example.com';
  const newCountBefore = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const newUser = await findOrCreateGoogleUser({
    sub: 'google-sub-new',
    email: newEmail,
    emailVerified: true
  });
  assert.ok(newUser);
  assert.strictEqual(newUser.email, newEmail);
  assert.strictEqual(newUser.role, 'student');
  assert.ok(newUser.id);
  const newCountAfter = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  assert.strictEqual(newCountAfter, newCountBefore + 1);

  // 5. An unverified Google e-mail never links to an existing account
  const staff = db.prepare('SELECT * FROM users WHERE role = ?').get('staff');
  await assert.rejects(
    () => findOrCreateGoogleUser({ sub: 'google-sub-attacker', email: staff.email, emailVerified: false }),
    (err) => err instanceof EmailNotVerified
  );
  assert.strictEqual(db.prepare('SELECT google_id FROM users WHERE id = ?').get(staff.id).google_id, null);

  try {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(tmpDb + '-wal')) fs.unlinkSync(tmpDb + '-wal');
    if (fs.existsSync(tmpDb + '-shm')) fs.unlinkSync(tmpDb + '-shm');
  } catch (e) {}
});
