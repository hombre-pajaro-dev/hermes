import { Pool } from 'pg';
import { applySchema } from '../db/schema';

async function migrate() {
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: POSTGRES_URL is not set. Add it to packages/backend/.env');
    process.exit(1);
  }

  const url = new URL(connectionString);
  const dbName = url.pathname.slice(1); // remove leading /

  // Connect to the default "postgres" database to create the target db if needed
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const ssl = isLocal ? false : { rejectUnauthorized: false };

  const adminPool = new Pool({ connectionString: adminUrl.toString(), ssl });
  console.log(`Ensuring database "${dbName}" exists...`);
  const { rows } = await adminPool.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName]
  );
  if (rows.length === 0) {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database "${dbName}".`);
  } else {
    console.log(`Database "${dbName}" already exists.`);
  }
  await adminPool.end();

  console.log('Applying schema...');
  const appPool = new Pool({ connectionString, ssl });
  await applySchema(appPool);
  await appPool.end();
  console.log('Done.');
}

migrate().catch(err => { console.error(err.message); process.exit(1); });
