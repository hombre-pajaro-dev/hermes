import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query(`
    SELECT le.*,
           ad.snapshot_name AS discount_name,
           ad.amount        AS discount_amount
    FROM ledger_entries le
    LEFT JOIN applied_discounts ad ON (
      (le.ref_type = 'order' AND ad.order_id = le.ref_id) OR
      (le.ref_type = 'tab'   AND ad.tab_id   = le.ref_id)
    )
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

export default router;
