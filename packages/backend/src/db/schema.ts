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
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
    ('cash', 'Cash Drawer'), ('credit_card', 'Credit Card'), ('payroll', 'Payroll'),
    ('inventory_adjustment', 'Inventory Adjustment'), ('savings', 'Savings')
    ON CONFLICT DO NOTHING
  `);
  await db.query(`ALTER TABLE register_sessions ADD COLUMN IF NOT EXISTS inventory_snapshot_open JSONB`);
  await db.query(`ALTER TABLE register_sessions ADD COLUMN IF NOT EXISTS inventory_snapshot_close JSONB`);
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT`);
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT TRUE`);

  // Discounts
  await db.query(`
    CREATE TABLE IF NOT EXISTS discounts (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      type            TEXT NOT NULL,
      value           DOUBLE PRECISION,
      buy_qty         INTEGER,
      get_qty         INTEGER,
      is_manual       BOOLEAN NOT NULL DEFAULT FALSE,
      requires_pin    BOOLEAN NOT NULL DEFAULT FALSE,
      days_of_week    INTEGER[],
      valid_from      TIMESTAMPTZ,
      valid_until     TIMESTAMPTZ,
      max_redemptions INTEGER,
      redemptions     INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS discount_products (
      discount_id  INTEGER NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
      product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (discount_id, product_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS applied_discounts (
      id             SERIAL PRIMARY KEY,
      discount_id    INTEGER REFERENCES discounts(id) ON DELETE SET NULL,
      order_id       INTEGER REFERENCES orders(id),
      tab_id         INTEGER REFERENCES tabs(id),
      snapshot_name  TEXT NOT NULL,
      snapshot_type  TEXT NOT NULL,
      amount         DOUBLE PRECISION NOT NULL,
      applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE tabs   ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0`);

  // Supplies
  await db.query(`
    CREATE TABLE IF NOT EXISTS supplies (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      unit       TEXT NOT NULL DEFAULT 'units',
      quantity   DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_supplies (
      product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supply_id         INTEGER NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
      quantity_per_unit DOUBLE PRECISION NOT NULL,
      PRIMARY KEY (product_id, supply_id)
    )
  `);

  // Payees
  await db.query(`
    CREATE TABLE IF NOT EXISTS payees (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      type           TEXT NOT NULL,
      default_weight DOUBLE PRECISION NOT NULL DEFAULT 1,
      source_account TEXT NOT NULL DEFAULT 'cash',
      active         BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS payees_name_idx ON payees(name)`);
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

  // Auth — authorized users allowlist (source of truth for who may sign in)
  await db.query(`
    CREATE TABLE IF NOT EXISTS authorized_users (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      role       TEXT NOT NULL DEFAULT 'staff',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed first admin from env var so the app is not locked out on fresh installs
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await db.query(
      `INSERT INTO authorized_users (email, role) VALUES ($1, 'admin') ON CONFLICT (email) DO NOTHING`,
      [adminEmail.toLowerCase()]
    );
  }

  // Better Auth internal tables — Kysely adapter expects camelCase column names
  // Drop and recreate if columns were previously created with snake_case names
  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'verification' AND column_name = 'expires_at'
      ) THEN
        DROP TABLE IF EXISTS "verification";
        DROP TABLE IF EXISTS "session";
        DROP TABLE IF EXISTS "account";
        DROP TABLE IF EXISTS "user";
      END IF;
    END $$
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      image           TEXT,
      role            TEXT NOT NULL DEFAULT 'staff',
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      id            TEXT PRIMARY KEY,
      "expiresAt"   TIMESTAMPTZ NOT NULL,
      token         TEXT NOT NULL UNIQUE,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress"   TEXT,
      "userAgent"   TEXT,
      "userId"      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS "account" (
      id                        TEXT PRIMARY KEY,
      "accountId"               TEXT NOT NULL,
      "providerId"              TEXT NOT NULL,
      "userId"                  TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken"             TEXT,
      "refreshToken"            TEXT,
      "idToken"                 TEXT,
      "accessTokenExpiresAt"    TIMESTAMPTZ,
      "refreshTokenExpiresAt"   TIMESTAMPTZ,
      scope                     TEXT,
      password                  TEXT,
      "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS "verification" (
      id            TEXT PRIMARY KEY,
      identifier    TEXT NOT NULL,
      value         TEXT NOT NULL,
      "expiresAt"   TIMESTAMPTZ NOT NULL,
      "createdAt"   TIMESTAMPTZ,
      "updatedAt"   TIMESTAMPTZ
    )
  `);
  // Ensure role column exists for databases created before this column was added
  await db.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff'`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await db.query(`INSERT INTO settings (key, value) VALUES ('pin', '1234') ON CONFLICT DO NOTHING`);
  await db.query(`ALTER TABLE tabs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);
  await db.query(`UPDATE tabs SET updated_at = created_at WHERE updated_at IS NULL`);

  // Audit trail
  await db.query(`ALTER TABLE tabs         ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await db.query(`ALTER TABLE tabs         ADD COLUMN IF NOT EXISTS paid_by    TEXT`);
  await db.query(`ALTER TABLE tab_items    ADD COLUMN IF NOT EXISTS added_by   TEXT`);
  await db.query(`ALTER TABLE tab_items    ADD COLUMN IF NOT EXISTS added_at   TIMESTAMPTZ`);
  await db.query(`ALTER TABLE orders       ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await db.query(`ALTER TABLE orders       ADD COLUMN IF NOT EXISTS paid_by    TEXT`);
  await db.query(`ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS created_by TEXT`);
}
