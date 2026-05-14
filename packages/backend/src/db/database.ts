import { Pool } from 'pg';
import { applySchema } from './schema.js';

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const isLocal = !connectionString || connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Apply schema eagerly so it runs before any route — including Better Auth routes
// that use pool directly and never call getDb().
export const schemaReady: Promise<void> = applySchema(pool).catch((err) => {
  console.error('[db] schema migration failed:', err);
});

export async function getDb(): Promise<Pool> {
  await schemaReady;
  return pool;
}

export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.query(`
    TRUNCATE products, register_sessions, orders, order_items, tabs, tab_items,
    cashouts, restock_orders, restock_items, inventory_adjustments, ledger_entries,
    accounts, settings, discounts, discount_products, applied_discounts,
    supplies, product_supplies, payees
    RESTART IDENTITY CASCADE
  `);
  await db.query(`
    INSERT INTO accounts (name, label) VALUES
    ('cash', 'Cash Drawer'), ('digital', 'Digital'), ('payroll', 'Payroll'),
    ('inventory_adjustment', 'Inventory Adjustment'), ('savings', 'Savings')
    ON CONFLICT DO NOTHING
  `);
  await db.query(`
    INSERT INTO payees (name, type, default_weight, source_account) VALUES
    ('Pajaro',           'staff',   1, 'cash'),
    ('MonGee',           'staff',   1, 'cash'),
    ('Mon',              'staff',   1, 'cash'),
    ('Paloma',           'staff',   1, 'cash'),
    ('Lola',             'staff',   1, 'cash'),
    ('Rent',             'expense', 1, 'cash'),
    ('Utilities',        'expense', 1, 'cash'),
    ('Capital Payments', 'expense', 1, 'cash'),
    ('Maintenance',      'expense', 1, 'cash'),
    ('Sound Equipment',  'expense', 1, 'cash'),
    ('Savings',          'savings', 1, 'cash')
    ON CONFLICT DO NOTHING
  `);
  await db.query(`INSERT INTO settings (key, value) VALUES ('pin', '1234') ON CONFLICT DO NOTHING`);
}
