import { Pool } from 'pg';

export async function applySchema(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        TEXT   NOT NULL UNIQUE,
      description TEXT   NOT NULL DEFAULT '',
      cost        DOUBLE PRECISION NOT NULL,
      price       DOUBLE PRECISION NOT NULL,
      units       DOUBLE PRECISION NOT NULL DEFAULT 0
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS register_sessions (
      id            SERIAL PRIMARY KEY,
      opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at     TIMESTAMPTZ,
      opening_cash  DOUBLE PRECISION NOT NULL DEFAULT 0,
      closing_cash  DOUBLE PRECISION,
      status        TEXT NOT NULL DEFAULT 'open'
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              SERIAL PRIMARY KEY,
      session_id      INTEGER NOT NULL REFERENCES register_sessions(id),
      status          TEXT NOT NULL DEFAULT 'pending',
      payment_method  TEXT,
      total           DOUBLE PRECISION NOT NULL DEFAULT 0,
      amount_received DOUBLE PRECISION,
      change_due      DOUBLE PRECISION,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at         TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id          SERIAL PRIMARY KEY,
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    DOUBLE PRECISION NOT NULL,
      unit_price  DOUBLE PRECISION NOT NULL,
      unit_cost   DOUBLE PRECISION NOT NULL,
      subtotal    DOUBLE PRECISION NOT NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS tabs (
      id             SERIAL PRIMARY KEY,
      session_id     INTEGER NOT NULL REFERENCES register_sessions(id),
      name           TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'open',
      at_cost        INTEGER NOT NULL DEFAULT 0,
      total          DOUBLE PRECISION NOT NULL DEFAULT 0,
      payment_method TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at        TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS tab_items (
      id          SERIAL PRIMARY KEY,
      tab_id      INTEGER NOT NULL REFERENCES tabs(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    DOUBLE PRECISION NOT NULL,
      unit_price  DOUBLE PRECISION NOT NULL,
      unit_cost   DOUBLE PRECISION NOT NULL,
      subtotal    DOUBLE PRECISION NOT NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS cashouts (
      id          SERIAL PRIMARY KEY,
      session_id  INTEGER NOT NULL REFERENCES register_sessions(id),
      amount      DOUBLE PRECISION NOT NULL,
      reason      TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS restock_orders (
      id          SERIAL PRIMARY KEY,
      session_id  INTEGER NOT NULL REFERENCES register_sessions(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS restock_items (
      id               SERIAL PRIMARY KEY,
      restock_order_id INTEGER NOT NULL REFERENCES restock_orders(id),
      product_id       INTEGER NOT NULL REFERENCES products(id),
      quantity         DOUBLE PRECISION NOT NULL,
      unit_cost        DOUBLE PRECISION NOT NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id             SERIAL PRIMARY KEY,
      session_id     INTEGER NOT NULL REFERENCES register_sessions(id),
      product_id     INTEGER NOT NULL REFERENCES products(id),
      previous_units DOUBLE PRECISION NOT NULL,
      physical_count DOUBLE PRECISION NOT NULL,
      delta          DOUBLE PRECISION NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id          SERIAL PRIMARY KEY,
      entry_type  TEXT NOT NULL,
      account     TEXT,
      amount      DOUBLE PRECISION NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      ref_id      INTEGER,
      ref_type    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id    SERIAL PRIMARY KEY,
      name  TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    )
  `);
  await db.query(`
    INSERT INTO accounts (name, label) VALUES
    ('cash', 'Cash Drawer'), ('credit_card', 'Credit Card'), ('payroll', 'Payroll')
    ON CONFLICT DO NOTHING
  `);
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await db.query(`INSERT INTO settings (key, value) VALUES ('pin', '1234') ON CONFLICT DO NOTHING`);
}
