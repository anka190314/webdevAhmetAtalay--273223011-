import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';
import { runMigrations } from './migrate.js';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2000
});

// An idle client can lose its connection (a database restart, or Neon scaling to zero).
// Without a listener, the pool's 'error' event would crash the whole process.
pool.on('error', (err) => {
  console.error('Idle database client error:', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function ping() {
  await query('SELECT 1');
}

export async function initDb() {
  await runMigrations(process.env.DATABASE_URL);
  await seedData();
}

async function seedData() {
  const labsRes = await query('SELECT COUNT(*)::int AS count FROM labs');
  if (labsRes.rows[0].count === 0) {
    const lab1Res = await query('INSERT INTO labs (name) VALUES ($1) RETURNING id', ['2140']);
    const lab2Res = await query('INSERT INTO labs (name) VALUES ($1) RETURNING id', ['2250']);

    const lab1Id = lab1Res.rows[0].id;
    const lab2Id = lab2Res.rows[0].id;

    await query('INSERT INTO workstations (lab_id, name) VALUES ($1, $2)', [lab1Id, 'W1']);
    await query('INSERT INTO workstations (lab_id, name) VALUES ($1, $2)', [lab1Id, 'W2']);
    await query('INSERT INTO workstations (lab_id, name) VALUES ($1, $2)', [lab1Id, 'W3']);
    await query('INSERT INTO workstations (lab_id, name) VALUES ($1, $2)', [lab2Id, 'W1']);
    await query('INSERT INTO workstations (lab_id, name) VALUES ($1, $2)', [lab2Id, 'W2']);
  }

  if (process.env.SEED_DEMO_USERS === 'true') {
    const usersRes = await query('SELECT COUNT(*)::int AS count FROM users');
    if (usersRes.rows[0].count === 0) {
      const studentEmail = 'student@example.com';
      const staffEmail = 'staff@example.com';

      const studentHash = await bcrypt.hash('password123', 10);
      const staffHash = await bcrypt.hash('admin123', 10);

      await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [studentEmail, studentHash, 'student']);
      await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [staffEmail, staffHash, 'staff']);
    }
  }
}
