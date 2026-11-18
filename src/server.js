import { initDb } from './db/database.js';
import app from './app.js';

const REQUIRED = ['SESSION_SECRET'];

for (const name of REQUIRED) {
  if (!process.env[name]) {
    console.error(`missing ${name}: see .env.example`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3000;

await initDb();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
