import { Router } from 'express';
import { getDb } from '../db/database.js';
import { requireAdmin } from '../middleware/require-admin.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query(`
    SELECT le.*,
           ad.snapshot_name AS discount_name,
           ad.amount        AS discount_amount,
           t.at_cost        AS tab_at_cost,
           t.created_by     AS tab_opened_by
    FROM ledger_entries le
    LEFT JOIN applied_discounts ad ON (
      (le.ref_type = 'order' AND ad.order_id = le.ref_id) OR
      (le.ref_type = 'tab'   AND ad.tab_id   = le.ref_id)
    )
    LEFT JOIN tabs t ON (le.ref_type = 'tab' AND t.id = le.ref_id)
    ORDER BY le.created_at DESC, le.id DESC
  `);
  res.json(rows);
});

router.get('/entries/:id/items', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM ledger_entries WHERE id = $1', [req.params.id]);
  const entry = rows[0] as { ref_id?: number; ref_type?: string } | undefined;
  if (!entry) return res.status(404).json({ error: 'Ledger entry not found' });
  if (!entry.ref_id || !entry.ref_type) return res.json([]);

  if (entry.ref_type === 'order') {
    const { rows: items } = await db.query(
      `SELECT oi.product_id, p.name, oi.quantity, oi.unit_price, oi.subtotal
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [entry.ref_id]
    );
    return res.json(items);
  }

  if (entry.ref_type === 'tab') {
    const { rows: items } = await db.query(
      `SELECT ti.product_id, p.name, ti.quantity, ti.unit_price, ti.subtotal
       FROM tab_items ti JOIN products p ON p.id = ti.product_id
       WHERE ti.tab_id = $1`,
      [entry.ref_id]
    );
    return res.json(items);
  }

  if (entry.ref_type === 'restock') {
    const { rows: items } = await db.query(
      `SELECT ri.product_id, p.name, ri.quantity, ri.unit_cost AS unit_price,
              (ri.quantity * ri.unit_cost) AS subtotal, ri.previous_cost
       FROM restock_items ri JOIN products p ON p.id = ri.product_id
       WHERE ri.restock_order_id = $1`,
      [entry.ref_id]
    );
    return res.json(items);
  }

  res.json([]);
});

router.get('/accounts', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM accounts');
  res.json(rows);
});

router.get('/balances', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query(`
    SELECT a.name as account, COALESCE(SUM(le.amount), 0) as balance
    FROM accounts a
    LEFT JOIN ledger_entries le ON le.account = a.name
    GROUP BY a.name
  `);
  res.json(rows);
});

router.post('/payroll', async (req, res) => {
  const { amount, account, description = '' } = req.body;
  if (!amount || !account) return res.status(400).json({ error: 'amount and account are required' });
  const db = await getDb();
  const { rows } = await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description) VALUES ('payroll', $1, $2, $3) RETURNING *",
    [account, -Math.abs(amount), description]
  );
  res.status(201).json(rows[0]);
});

router.post('/transfer', requireAdmin, async (req, res) => {
  const { from_account, to_account, amount, description = '' } = req.body as {
    from_account?: string; to_account?: string; amount?: number; description?: string;
  };
  if (!from_account || !to_account) return res.status(400).json({ error: 'from_account and to_account are required' });
  if (from_account === to_account) return res.status(400).json({ error: 'from_account and to_account must be different' });
  const num = Number(amount);
  if (!amount || isNaN(num) || num <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  const db = await getDb();
  const { rows: accts } = await db.query('SELECT name FROM accounts WHERE name = ANY($1)', [[from_account, to_account]]);
  const found = (accts as { name: string }[]).map(a => a.name);
  if (!found.includes(from_account)) return res.status(400).json({ error: `Unknown account: ${from_account}` });
  if (!found.includes(to_account)) return res.status(400).json({ error: `Unknown account: ${to_account}` });
  const desc = description.trim() || `Transfer ${from_account} → ${to_account}`;
  const { rows: [debit] } = await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description) VALUES ('transfer', $1, $2, $3) RETURNING *",
    [from_account, -num, desc],
  );
  const { rows: [credit] } = await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description) VALUES ('transfer', $1, $2, $3) RETURNING *",
    [to_account, num, desc],
  );
  res.status(201).json({ debit, credit });
});

router.post('/adjustment', requireAdmin, async (req, res) => {
  const { account, amount, description = '' } = req.body;
  if (!account || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'account and amount are required' });
  }
  const num = Number(amount);
  if (isNaN(num) || num === 0) {
    return res.status(400).json({ error: 'amount must be a non-zero number' });
  }
  const db = await getDb();
  const { rows: accts } = await db.query('SELECT name FROM accounts WHERE name = $1', [account]);
  if (accts.length === 0) return res.status(400).json({ error: 'Unknown account' });
  const { rows } = await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description) VALUES ('account_adjustment', $1, $2, $3) RETURNING *",
    [account, num, description]
  );
  res.status(201).json(rows[0]);
});

export default router;
