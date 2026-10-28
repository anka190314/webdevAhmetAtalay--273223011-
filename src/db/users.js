import { db } from './database.js';

export function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) || null;
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT id, email, role, google_id FROM users WHERE id = ?');
  return stmt.get(id) || null;
}
