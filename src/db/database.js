import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';
import { runMigrations } from './migrate.js';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDb() {
  await runMigrations(process.env.DATABASE_URL);
  await seedData();
}

async function seedData() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const res = await query('SELECT COUNT(*)::int AS count FROM users');
  if (res.rows[0].count > 0) {
    return;
  }

  const studentEmail = 'student@example.com';
  const staffEmail = 'staff@example.com';

  const studentHash = await bcrypt.hash('password123', 10);
  const staffHash = await bcrypt.hash('admin123', 10);

  await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [studentEmail, studentHash, 'student']);
  await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [staffEmail, staffHash, 'staff']);

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
