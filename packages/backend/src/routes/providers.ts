import { Router } from 'express';
import { getDb } from '../db/database.js';
import { requireAdmin } from '../middleware/require-admin.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM providers ORDER BY name');
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const db = await getDb();
  const { rows } = await db.query(
    'INSERT INTO providers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
    [name.trim()]
  );
  res.status(201).json(rows[0]);
});

export default router;
