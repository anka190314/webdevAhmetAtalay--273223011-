import { getUserByEmail, getUserById } from '../db/users.js';
import bcrypt from 'bcrypt';

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
