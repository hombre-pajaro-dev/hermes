import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const entries = getDb().prepare('SELECT * FROM ledger_entries ORDER BY created_at DESC, id DESC').all();
  res.json(entries);
});

router.get('/accounts', (_req, res) => {
  const accounts = getDb().prepare('SELECT * FROM accounts').all();
  res.json(accounts);
});

router.get('/balances', (_req, res) => {
  const balances = getDb().prepare(
    `SELECT a.name as account, COALESCE(SUM(le.amount), 0) as balance
     FROM accounts a
     LEFT JOIN ledger_entries le ON le.account = a.name
     GROUP BY a.name`
  ).all();
  res.json(balances);
});

router.post('/payroll', (req, res) => {
  const { amount, account, description = '' } = req.body;
  if (!amount || !account) return res.status(400).json({ error: 'amount and account are required' });
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO ledger_entries (entry_type, account, amount, description) VALUES ('payroll', ?, ?, ?)"
  ).run(account, -Math.abs(amount), description);
  const entry = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

export default router;
