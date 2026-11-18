import { initDb, pool } from '../src/db/database.js';
import { createAccount } from '../src/services/authService.js';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

async function main() {
  const [,, email, role] = process.argv;
  if (!email || !role) {
    console.error('Usage: npm run create-user -- <email> <student|staff>');
    process.exit(1);
  }

  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });
  process.stdout.write('Password: ');
  const password = await rl.question('');
  rl.close();
  console.log();

  try {
    await initDb();
    await createAccount({ email, password, role });
    console.log(`created ${email} as ${role}`);
  } catch (err) {
    console.log(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
