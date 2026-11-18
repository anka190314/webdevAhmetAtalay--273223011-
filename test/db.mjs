import pg from 'pg';

export async function createTestSchema() {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgres://postgres:test@localhost:5432/postgres';
  if (databaseUrl.includes('neon.tech')) {
    throw new Error('Refusing to run tests against Neon production database');
  }

  process.env.SEED_DEMO_USERS = 'true';

  const schemaName = `test_${Math.random().toString(36).substring(2, 11)}`;

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await client.end();
  }

  const urlObj = new URL(databaseUrl);
  urlObj.searchParams.set('options', `-c search_path=${schemaName}`);
  const url = urlObj.toString();

  const drop = async () => {
    const dropClient = new pg.Client({ connectionString: databaseUrl });
    await dropClient.connect();
    try {
      await dropClient.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    } finally {
      await dropClient.end();
    }
  };

  return { url, drop };
}
