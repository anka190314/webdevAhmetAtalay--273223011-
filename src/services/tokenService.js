import crypto from 'node:crypto';
import { insertTokenRecord, getUserByTokenHash } from '../db/tokens.js';
import { getUserByEmail } from '../db/users.js';

export async function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  insertTokenRecord(userId, tokenHash);
  return token;
}

export async function resolveToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return getUserByTokenHash(tokenHash);
}

export async function createTokenForEmail(email) {
  const user = getUserByEmail(email);
  if (!user) {
    return null;
  }
  return generateToken(user.id);
}