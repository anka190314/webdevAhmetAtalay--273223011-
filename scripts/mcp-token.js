import { initDb } from '../src/db/database.js';
import { createTokenForEmail } from '../src/services/tokenService.js';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run mcp-token -- <email>');
    process.exit(1);
  }

  await initDb();

  const token = await createTokenForEmail(email);
  if (!token) {
    console.error(`User with email "${email}" not found.`);
    process.exit(1);
  }
  console.log(token);
}

main().catch((err) => {
  console.error('Error generating MCP token:', err);
  process.exit(1);
});