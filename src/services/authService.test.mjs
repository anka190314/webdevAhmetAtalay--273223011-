import { test, after } from 'node:test';
import assert from 'node:assert';
import { createTestSchema } from '../../test/db.mjs';

const { url, drop } = await createTestSchema();
process.env.DATABASE_URL = url;

const { initDb, pool, query } = await import('../db/database.js');
const { findOrCreateGoogleUser, createAccount, authenticateUser, getServiceUserById } = await import('./authService.js');
const { EmailNotVerified, InvalidInput, EmailTaken } = await import('./errors.js');

after(async () => {
  await pool.end();
  await drop();
});

test('AC-11 Google auth and linking', async () => {
  await initDb();

  const seededStudentRes = await query('SELECT * FROM users WHERE role = $1', ['student']);
  const seededStudent = seededStudentRes.rows[0];
  assert.ok(seededStudent, 'Seeded student exists');

  const initialCountRes = await query('SELECT COUNT(*)::int as count FROM users');
  const initialCount = initialCountRes.rows[0].count;

  // 1. Seeded student signs in with Google with the same e-mail and gets the same id, and the users count does not change
  const user1 = await findOrCreateGoogleUser({
    sub: 'google-sub-123',
    email: seededStudent.email,
    emailVerified: true
  });
  assert.strictEqual(user1.id, seededStudent.id);
  const countAfter1Res = await query('SELECT COUNT(*)::int as count FROM users');
  const countAfter1 = countAfter1Res.rows[0].count;
  assert.strictEqual(countAfter1, initialCount);

  // 2. A second call with the same sub returns the same user
  const user2 = await findOrCreateGoogleUser({
    sub: 'google-sub-123',
    email: seededStudent.email,
    emailVerified: true
  });
  assert.strictEqual(user2.id, seededStudent.id);
  const countAfter2Res = await query('SELECT COUNT(*)::int as count FROM users');
  const countAfter2 = countAfter2Res.rows[0].count;
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
  const unlinkedUserRes = await query('SELECT * FROM users WHERE email = $1', [unverifiedEmail]);
  const unlinkedUser = unlinkedUserRes.rows[0];
  assert.strictEqual(unlinkedUser, undefined);

  // 4. A new e-mail creates exactly one student
  const newEmail = 'newstudent@example.com';
  const newCountBeforeRes = await query('SELECT COUNT(*)::int as count FROM users');
  const newCountBefore = newCountBeforeRes.rows[0].count;
  const newUser = await findOrCreateGoogleUser({
    sub: 'google-sub-new',
    email: newEmail,
    emailVerified: true
  });
  assert.ok(newUser);
  assert.strictEqual(newUser.email, newEmail);
  assert.strictEqual(newUser.role, 'student');
  assert.ok(newUser.id);
  const newCountAfterRes = await query('SELECT COUNT(*)::int as count FROM users');
  const newCountAfter = newCountAfterRes.rows[0].count;
  assert.strictEqual(newCountAfter, newCountBefore + 1);

  // 5. An unverified Google e-mail never links to an existing account
  const staffRes = await query('SELECT * FROM users WHERE role = $1', ['staff']);
  const staff = staffRes.rows[0];
  await assert.rejects(
    () => findOrCreateGoogleUser({ sub: 'google-sub-attacker', email: staff.email, emailVerified: false }),
    (err) => err instanceof EmailNotVerified
  );
  const staffCheckRes = await query('SELECT google_id FROM users WHERE id = $1', [staff.id]);
  assert.strictEqual(staffCheckRes.rows[0].google_id, null);
});

test('createAccount validation, success, and duplicate email', async () => {
  await initDb();

  // Refuses password < 12 chars
  await assert.rejects(
    () => createAccount({ email: 'user1@example.com', password: 'short', role: 'student' }),
    (err) => err instanceof InvalidInput
  );

  // Refuses role other than student or staff
  await assert.rejects(
    () => createAccount({ email: 'user1@example.com', password: 'longenoughpassword', role: 'admin' }),
    (err) => err instanceof InvalidInput
  );

  // Success
  const created = await createAccount({ email: 'user1@example.com', password: 'longenoughpassword', role: 'student' });
  assert.ok(created);
  assert.strictEqual(created.email, 'user1@example.com');
  assert.strictEqual(created.role, 'student');
  assert.ok(created.id);

  // Refuses duplicate email
  await assert.rejects(
    () => createAccount({ email: 'user1@example.com', password: 'anotherlongpassword', role: 'staff' }),
    (err) => err instanceof EmailTaken
  );
});

test('authenticateUser and getServiceUserById success and failure cases', async () => {
  await initDb();

  const email = 'authcheck@example.com';
  const password = 'longenoughpassword123';
  const created = await createAccount({ email, password, role: 'student' });
  assert.ok(created);

  // Successful authentication
  const authSuccess = await authenticateUser(email, password);
  assert.ok(authSuccess);
  assert.strictEqual(authSuccess.email, email);
  assert.strictEqual(authSuccess.password_hash, undefined);

  // Nonexistent email returns null
  const authNonexistent = await authenticateUser('nonexistent@example.com', password);
  assert.strictEqual(authNonexistent, null);

  // Incorrect password returns null
  const authWrongPassword = await authenticateUser(email, 'wrongpassword123');
  assert.strictEqual(authWrongPassword, null);

  // getServiceUserById
  const fetchedUser = await getServiceUserById(created.id);
  assert.ok(fetchedUser);
  assert.strictEqual(fetchedUser.id, created.id);

  const fetchedNonexistent = await getServiceUserById(999999);
  assert.strictEqual(fetchedNonexistent, null);
});
