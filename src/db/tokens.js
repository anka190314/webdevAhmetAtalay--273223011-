import { db } from './database.js';

export function insertTokenRecord(userId, tokenHash) {
  const stmt = db.prepare('INSERT INTO mcp_tokens (user_id, token_hash) VALUES (?, ?)');
  return stmt.run(userId, tokenHash);
}

export function getUserByTokenHash(tokenHash) {
  const stmt = db.prepare(`
    SELECT u.id, u.email, u.role, u.google_id
    FROM mcp_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.token_hash = ?
  `);
  return stmt.get(tokenHash) || null;
}
