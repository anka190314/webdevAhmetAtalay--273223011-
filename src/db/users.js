import { db } from './database.js';

export function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) || null;
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT id, email, role, google_id FROM users WHERE id = ?');
  return stmt.get(id) || null;
}

export function getUserByGoogleId(googleId) {
  const stmt = db.prepare('SELECT * FROM users WHERE google_id = ?');
  return stmt.get(googleId) || null;
}

export function updateUserGoogleId(id, googleId) {
  const stmt = db.prepare('UPDATE users SET google_id = ? WHERE id = ?');
  stmt.run(googleId, id);
  const stmtGet = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmtGet.get(id) || null;
}

export function createUser({ email, passwordHash, role, googleId }) {
  const stmt = db.prepare('INSERT INTO users (email, password_hash, role, google_id) VALUES (?, ?, ?, ?)');
  stmt.run(email, passwordHash, role, googleId);
  return getUserByEmail(email);
}
