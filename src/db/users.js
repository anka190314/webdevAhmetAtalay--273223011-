import { query } from './database.js';

export async function getUserByEmail(email) {
  const res = await query('SELECT * FROM users WHERE email = $1', [email]);
  return res.rows[0] || null;
}

export async function getUserById(id) {
  const res = await query('SELECT id, email, role, google_id FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function getUserByGoogleId(googleId) {
  const res = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  return res.rows[0] || null;
}

export async function updateUserGoogleId(id, googleId) {
  await query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, id]);
  return getUserById(id);
}

export async function createUser({ email, passwordHash, role, googleId }) {
  await query('INSERT INTO users (email, password_hash, role, google_id) VALUES ($1, $2, $3, $4)', [email, passwordHash, role, googleId]);
  return getUserByEmail(email);
}
