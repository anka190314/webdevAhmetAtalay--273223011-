import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function runMigrations(dbPath = process.env.DB_PATH || join('data', 'app.db')) {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = join(__dirname, '../../migrations');
  if (!existsSync(migrationsDir)) {
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const getApplied = db.prepare('SELECT name FROM schema_migrations');
  const appliedRows = getApplied.all();
  const appliedSet = new Set(appliedRows.map((r) => r.name));

  const insertMigration = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const file of files) {
    if (!appliedSet.has(file)) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf8');
      db.exec('BEGIN TRANSACTION;');
      try {
        db.exec(sql);
        insertMigration.run(file);
        db.exec('COMMIT;');
        console.log(`Applied migration: ${file}`);
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runMigrations();
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}
