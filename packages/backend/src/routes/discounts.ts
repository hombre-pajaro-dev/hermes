import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET /discounts — all discounts with their qualifying product IDs
router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows: discounts } = await db.query('SELECT * FROM discounts ORDER BY created_at DESC');
  const { rows: dps } = await db.query('SELECT discount_id, product_id FROM discount_products');
  const result = discounts.map(d => ({
    ...d,
    product_ids: dps.filter(dp => dp.discount_id === d.id).map((dp: { product_id: number }) => dp.product_id),
  }));
  res.json(result);
});

// POST /discounts — create a discount
router.post('/', async (req, res) => {
  const db = await getDb();
  const {
    name, description, type, value, buy_qty, get_qty,
    is_manual, requires_pin, days_of_week, valid_from, valid_until,
    max_redemptions, product_ids,
  } = req.body as {
    name: string; description?: string; type: string; value?: number;
    buy_qty?: number; get_qty?: number; is_manual?: boolean; requires_pin?: boolean;
    days_of_week?: number[]; valid_from?: string; valid_until?: string;
    max_redemptions?: number; product_ids?: number[];
  };

  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (!['percentage', 'bxgy'].includes(type)) return res.status(400).json({ error: 'type must be percentage or bxgy' });
  if (type === 'percentage' && (value == null || value <= 0 || value > 100)) {
    return res.status(400).json({ error: 'value must be 1–100 for percentage discounts' });
  }
  if (type === 'bxgy') {
    if (!buy_qty || buy_qty < 1) return res.status(400).json({ error: 'buy_qty is required for bxgy' });
    if (!get_qty || get_qty < 1) return res.status(400).json({ error: 'get_qty is required for bxgy' });
    if (!product_ids || product_ids.length === 0) return res.status(400).json({ error: 'bxgy discounts require at least one product' });
  }

  const { rows: [discount] } = await db.query(
    `INSERT INTO discounts
       (name, description, type, value, buy_qty, get_qty, is_manual, requires_pin,
        days_of_week, valid_from, valid_until, max_redemptions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      name, description ?? '', type,
      value ?? null, buy_qty ?? null, get_qty ?? null,
      is_manual ?? false, requires_pin ?? false,
      days_of_week && days_of_week.length > 0 ? days_of_week : null,
      valid_from || null, valid_until || null,
      max_redemptions || null,
    ],
  );

  const ids = product_ids ?? [];
  for (const pid of ids) {
    await db.query('INSERT INTO discount_products (discount_id, product_id) VALUES ($1,$2)', [discount.id, pid]);
  }

  res.status(201).json({ ...discount, product_ids: ids });
});

// PATCH /discounts/:id — update a discount
router.patch('/:id', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT id FROM discounts WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Discount not found' });

  const {
    name, description, type, value, buy_qty, get_qty,
    is_manual, requires_pin, days_of_week, valid_from, valid_until,
    max_redemptions, active, product_ids,
  } = req.body as Record<string, unknown>;

  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  const set = (col: string, v: unknown) => { fields.push(`${col} = $${idx++}`); vals.push(v); };

  if (name !== undefined) set('name', name);
  if (description !== undefined) set('description', description);
  if (type !== undefined) set('type', type);
  if (value !== undefined) set('value', value);
  if (buy_qty !== undefined) set('buy_qty', buy_qty);
  if (get_qty !== undefined) set('get_qty', get_qty);
  if (is_manual !== undefined) set('is_manual', is_manual);
  if (requires_pin !== undefined) set('requires_pin', requires_pin);
  if (days_of_week !== undefined) {
    set('days_of_week', Array.isArray(days_of_week) && (days_of_week as number[]).length > 0 ? days_of_week : null);
  }
  if (valid_from !== undefined) set('valid_from', valid_from || null);
  if (valid_until !== undefined) set('valid_until', valid_until || null);
  if (max_redemptions !== undefined) set('max_redemptions', max_redemptions || null);
  if (active !== undefined) set('active', active);

  if (fields.length > 0) {
    vals.push(req.params.id);
    await db.query(`UPDATE discounts SET ${fields.join(', ')} WHERE id = $${idx}`, vals);
  }

  if (product_ids !== undefined) {
    await db.query('DELETE FROM discount_products WHERE discount_id = $1', [req.params.id]);
    for (const pid of product_ids as number[]) {
      await db.query('INSERT INTO discount_products (discount_id, product_id) VALUES ($1,$2)', [req.params.id, pid]);
    }
  }

  const { rows: [updated] } = await db.query('SELECT * FROM discounts WHERE id = $1', [req.params.id]);
  const { rows: dps } = await db.query('SELECT product_id FROM discount_products WHERE discount_id = $1', [req.params.id]);
  res.json({ ...updated, product_ids: dps.map((dp: { product_id: number }) => dp.product_id) });
});

// DELETE /discounts/:id
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT id FROM discounts WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Discount not found' });
  await db.query('DELETE FROM discounts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
