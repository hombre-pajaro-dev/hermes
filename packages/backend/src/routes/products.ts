import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', async (req, res) => {
  const db = await getDb();
  if (req.query.name) {
    const { rows } = await db.query('SELECT * FROM products WHERE name = $1', [req.query.name]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  }
  const { rows } = await db.query('SELECT * FROM products ORDER BY name');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { name, description = '', cost, price, units = 0 } = req.body;
  if (!name || cost == null || price == null) {
    return res.status(400).json({ error: 'name, cost, and price are required' });
  }
  const db = await getDb();
  const { rows } = await db.query(
    'INSERT INTO products (name, description, cost, price, units) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, description, cost, price, units]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id/price', async (req, res) => {
  const { price } = req.body;
  if (price == null) return res.status(400).json({ error: 'price is required' });
  if (typeof price !== 'number' || price <= 0) return res.status(400).json({ error: 'price must be greater than 0' });
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  const { rows: openTab } = await db.query(
    `SELECT COUNT(*)::int as count FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id WHERE ti.product_id = $1 AND t.status = 'open'`,
    [req.params.id]
  );
  if (openTab[0].count > 0) return res.status(409).json({ error: 'Cannot modify price: product is in one or more open tabs' });
  const { rows } = await db.query('UPDATE products SET price = $1 WHERE id = $2 RETURNING *', [price, req.params.id]);
  res.json(rows[0]);
});

router.patch('/:id/cost', async (req, res) => {
  const { cost } = req.body;
  if (cost == null) return res.status(400).json({ error: 'cost is required' });
  if (typeof cost !== 'number' || cost <= 0) return res.status(400).json({ error: 'cost must be greater than 0' });
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  const { rows: openTab } = await db.query(
    `SELECT COUNT(*)::int as count FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id WHERE ti.product_id = $1 AND t.status = 'open'`,
    [req.params.id]
  );
  if (openTab[0].count > 0) return res.status(409).json({ error: 'Cannot modify cost: product is in one or more open tabs' });
  const { rows } = await db.query('UPDATE products SET cost = $1 WHERE id = $2 RETURNING *', [cost, req.params.id]);
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, description, cost, price, units } = req.body;
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  const e = existing[0];
  const { rows } = await db.query(
    'UPDATE products SET name=$1, description=$2, cost=$3, price=$4, units=$5 WHERE id=$6 RETURNING *',
    [name ?? e.name, description ?? e.description, cost ?? e.cost, price ?? e.price, units ?? e.units, req.params.id]
  );
  res.json(rows[0]);
});

export default router;
