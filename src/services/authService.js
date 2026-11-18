import { getUserByEmail, getUserById, getUserByGoogleId, updateUserGoogleId, createUser } from '../db/users.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { EmailNotVerified } from './errors.js';

export async function authenticateUser(email, password) {
  const user = getUserByEmail(email);
  if (!user) {
    return null;
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return null;
  }
  const { password_hash, ...rest } = user;
  return rest;
}

export function getServiceUserById(id) {
  return getUserById(id);
}

export async function findOrCreateGoogleUser({ sub, email, emailVerified }) {
  const existingByGoogle = getUserByGoogleId(sub);
  if (existingByGoogle) {
    const { password_hash, ...rest } = existingByGoogle;
    return rest;
  }

  if (!emailVerified) {
    throw new EmailNotVerified('Email not verified');
  }

  const existingByEmail = getUserByEmail(email);
  if (existingByEmail) {
    const updated = updateUserGoogleId(existingByEmail.id, sub);
    const { password_hash, ...rest } = updated;
    return rest;
  }

  const randomBytes = crypto.randomBytes(32);
  const passwordHash = await bcrypt.hash(randomBytes, 10);
  const newUser = createUser({
    email,
    passwordHash,
    role: 'student',
    googleId: sub
  });
  const { password_hash, ...rest } = newUser;
  return rest;
}
