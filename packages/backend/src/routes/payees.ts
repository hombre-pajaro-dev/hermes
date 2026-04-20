import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM payees ORDER BY type, name');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, type, default_weight = 1, source_account = 'cash' } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (!['staff', 'expense', 'savings'].includes(type)) {
    return res.status(400).json({ error: 'type must be staff, expense, or savings' });
  }
  const db = await getDb();
  const { rows } = await db.query(
    'INSERT INTO payees (name, type, default_weight, source_account) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, type, default_weight, source_account]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM payees WHERE id = $1', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Payee not found' });
  const p = existing[0] as { name: string; type: string; default_weight: number; source_account: string; active: boolean };
  const { name, type, default_weight, source_account, active } = req.body;
  const { rows } = await db.query(
    'UPDATE payees SET name = $1, type = $2, default_weight = $3, source_account = $4, active = $5 WHERE id = $6 RETURNING *',
    [
      name ?? p.name,
      type ?? p.type,
      default_weight ?? p.default_weight,
      source_account ?? p.source_account,
      active !== undefined ? active : p.active,
      id,
    ]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = await getDb();
  const { rowCount } = await db.query('DELETE FROM payees WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Payee not found' });
  res.json({ ok: true });
});

export default router;
