import { Pool } from 'pg';
import { applySchema } from './schema';

export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ?? process.env.DATABASE_URL,
  ssl: process.env.POSTGRES_URL ? { rejectUnauthorized: false } : false,
});

let schemaPromise: Promise<void> | null = null;

export async function getDb(): Promise<Pool> {
  if (!schemaPromise) {
    schemaPromise = applySchema(pool);
  }
  await schemaPromise;
  return pool;
}

export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.query(`
    TRUNCATE products, register_sessions, orders, order_items, tabs, tab_items,
    cashouts, restock_orders, restock_items, inventory_adjustments, ledger_entries,
    accounts, settings RESTART IDENTITY CASCADE
  `);
  await db.query(`
    INSERT INTO accounts (name, label) VALUES
    ('cash', 'Cash Drawer'), ('credit_card', 'Credit Card'), ('payroll', 'Payroll')
    ON CONFLICT DO NOTHING
  `);
  await db.query(`INSERT INTO settings (key, value) VALUES ('pin', '1234') ON CONFLICT DO NOTHING`);
}
