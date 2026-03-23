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
}
