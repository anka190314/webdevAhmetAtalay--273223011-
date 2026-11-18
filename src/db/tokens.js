import { query } from './database.js';

export async function insertTokenRecord(userId, tokenHash) {
  const res = await query('INSERT INTO mcp_tokens (user_id, token_hash) VALUES ($1, $2) RETURNING id', [userId, tokenHash]);
  return { id: res.rows[0].id };
}

export async function getUserByTokenHash(tokenHash) {
  const res = await query(`
    SELECT u.id, u.email, u.role, u.google_id
    FROM mcp_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.token_hash = $1
  `, [tokenHash]);
  return res.rows[0] || null;
}
