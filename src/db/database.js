import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import bcrypt from 'bcrypt';
import { runMigrations } from './migrate.js';

const dbPath = process.env.DB_PATH || join('data', 'app.db');
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

export async function initDb() {
  runMigrations(dbPath);
  await seedData();
}

async function seedData() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (row.count > 0) {
    return;
  }

  const studentEmail = 'student@example.com';
  const staffEmail = 'staff@example.com';

  const studentHash = await bcrypt.hash('password123', 10);
  const staffHash = await bcrypt.hash('admin123', 10);

  const insertUser = db.prepare(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`);
  insertUser.run(studentEmail, studentHash, 'student');
  insertUser.run(staffEmail, staffHash, 'staff');

  const insertLab = db.prepare(`INSERT INTO labs (name) VALUES (?)`);
  const lab1Res = insertLab.run('2140');
  const lab2Res = insertLab.run('2250');

  const insertWs = db.prepare(`INSERT INTO workstations (lab_id, name) VALUES (?, ?)`);
  insertWs.run(lab1Res.lastInsertRowid, 'W1');
  insertWs.run(lab1Res.lastInsertRowid, 'W2');
  insertWs.run(lab1Res.lastInsertRowid, 'W3');
  insertWs.run(lab2Res.lastInsertRowid, 'W1');
  insertWs.run(lab2Res.lastInsertRowid, 'W2');
}
