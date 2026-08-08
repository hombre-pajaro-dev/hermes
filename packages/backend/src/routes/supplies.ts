import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET /api/supplies — list all supplies
router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM supplies ORDER BY name');
  res.json(rows);
});

// POST /api/supplies — create a supply
router.post('/', async (req, res) => {
  const { name, unit = 'units', quantity = 0, cost = 0 } = req.body as { name: string; unit?: string; quantity?: number; cost?: number };
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (quantity != null && quantity < 0) return res.status(400).json({ error: 'quantity cannot be negative' });
  if (cost != null && cost < 0) return res.status(400).json({ error: 'cost cannot be negative' });
  const db = await getDb();
  try {
    const { rows } = await db.query(
      'INSERT INTO supplies (name, unit, quantity, cost) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, unit, quantity ?? 0, cost ?? 0],
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('unique')) return res.status(409).json({ error: `Supply "${name}" already exists` });
    res.status(500).json({ error: msg });
  }
});

// PATCH /api/supplies/:id — update name, unit, quantity, or cost
router.patch('/:id', async (req, res) => {
  const { name, unit, quantity, cost } = req.body as { name?: string; unit?: string; quantity?: number; cost?: number };
  const db = await getDb();
  const { rows: [existing] } = await db.query('SELECT * FROM supplies WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Supply not found' });
  if (quantity != null && quantity < 0) return res.status(400).json({ error: 'quantity cannot be negative' });
  if (cost != null && (typeof cost !== 'number' || cost < 0)) return res.status(400).json({ error: 'cost cannot be negative' });

  if (cost != null && cost !== existing.cost) {
    const { rows: openTab } = await db.query(
      `SELECT COUNT(*)::int as count
       FROM tab_items ti
       JOIN tabs t ON t.id = ti.tab_id AND t.status = 'open'
       JOIN product_supplies ps ON ps.product_id = ti.product_id
       WHERE ps.supply_id = $1`,
      [req.params.id],
    );
    if (openTab[0].count > 0) {
      return res.status(409).json({ error: 'Cannot modify cost: a product using this supply is in one or more open tabs' });
    }
  }

  try {
    const { rows } = await db.query(
      'UPDATE supplies SET name = $1, unit = $2, quantity = $3, cost = $4 WHERE id = $5 RETURNING *',
      [name ?? existing.name, unit ?? existing.unit, quantity ?? existing.quantity, cost ?? existing.cost, req.params.id],
    );
    res.json(rows[0]);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('unique')) return res.status(409).json({ error: `Supply "${name}" already exists` });
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/supplies/:id — only if no products use it
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const { rows: [existing] } = await db.query('SELECT * FROM supplies WHERE id = $1', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Supply not found' });
  const { rows: products } = await db.query(
    `SELECT p.name FROM product_supplies ps
     JOIN products p ON p.id = ps.product_id
     WHERE ps.supply_id = $1`,
    [req.params.id],
  );
  if (products.length > 0) {
    const names = products.map((p: { name: string }) => p.name).join(', ');
    return res.status(409).json({ error: `Supply is used by: ${names}. Remove it from those products first.` });
  }
  await db.query('DELETE FROM supplies WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
