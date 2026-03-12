import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM ledger_entries ORDER BY created_at DESC, id DESC');
  res.json(rows);
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
