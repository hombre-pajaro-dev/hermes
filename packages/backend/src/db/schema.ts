import Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT    NOT NULL DEFAULT '',
      cost        REAL    NOT NULL,
      price       REAL    NOT NULL,
      units       REAL    NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS register_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      closed_at     TEXT,
      opening_cash  REAL    NOT NULL DEFAULT 0,
      closing_cash  REAL,
      status        TEXT    NOT NULL DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      INTEGER NOT NULL REFERENCES register_sessions(id),
      status          TEXT    NOT NULL DEFAULT 'pending',
      payment_method  TEXT,
      total           REAL    NOT NULL DEFAULT 0,
      amount_received REAL,
      change_due      REAL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      paid_at         TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    REAL    NOT NULL,
      unit_price  REAL    NOT NULL,
      unit_cost   REAL    NOT NULL,
      subtotal    REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tabs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     INTEGER NOT NULL REFERENCES register_sessions(id),
      name           TEXT    NOT NULL DEFAULT '',
      status         TEXT    NOT NULL DEFAULT 'open',
      total          REAL    NOT NULL DEFAULT 0,
      payment_method TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      paid_at        TEXT
    );

    CREATE TABLE IF NOT EXISTS tab_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_id      INTEGER NOT NULL REFERENCES tabs(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    REAL    NOT NULL,
      unit_price  REAL    NOT NULL,
      unit_cost   REAL    NOT NULL,
      subtotal    REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashouts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES register_sessions(id),
      amount      REAL    NOT NULL,
      reason      TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restock_orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES register_sessions(id),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restock_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      restock_order_id INTEGER NOT NULL REFERENCES restock_orders(id),
      product_id       INTEGER NOT NULL REFERENCES products(id),
      quantity         REAL    NOT NULL,
      unit_cost        REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     INTEGER NOT NULL REFERENCES register_sessions(id),
      product_id     INTEGER NOT NULL REFERENCES products(id),
      previous_units REAL    NOT NULL,
      physical_count REAL    NOT NULL,
      delta          REAL    NOT NULL,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_type  TEXT    NOT NULL,
      account     TEXT,
      amount      REAL    NOT NULL DEFAULT 0,
      description TEXT    NOT NULL DEFAULT '',
      ref_id      INTEGER,
      ref_type    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );

    INSERT OR IGNORE INTO accounts (name, label) VALUES ('cash', 'Cash Drawer');
    INSERT OR IGNORE INTO accounts (name, label) VALUES ('credit_card', 'Credit Card');
    INSERT OR IGNORE INTO accounts (name, label) VALUES ('payroll', 'Payroll');
  `);
}
