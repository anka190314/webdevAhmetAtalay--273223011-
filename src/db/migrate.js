import pkg from 'pg';
const { Pool } = pkg;
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(connectionString = process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    const migrationsDir = join(__dirname, '../../migrations');
    if (!existsSync(migrationsDir)) {
      return;
    }

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedRes = await pool.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map((r) => r.name));

    for (const file of files) {
      if (!appliedSet.has(file)) {
        const filePath = join(migrationsDir, file);
        const sql = readFileSync(filePath, 'utf8');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.error(`Applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runMigrations();
    console.error('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}
