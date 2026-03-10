import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (req, res) => {
  const { name } = req.query;
  const db = getDb();
  if (name) {
    const product = db.prepare('SELECT * FROM products WHERE name = ?').get(name as string);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  }
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  res.json(products);
});

router.get('/:id', (req, res) => {
  const product = getDb().prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', (req, res) => {
  const { name, description = '', cost, price, units = 0 } = req.body;
  if (!name || cost == null || price == null) {
    return res.status(400).json({ error: 'name, cost, and price are required' });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO products (name, description, cost, price, units) VALUES (?, ?, ?, ?, ?)'
  ).run(name, description, cost, price, units);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

router.put('/:id', (req, res) => {
  const { name, description, cost, price, units } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.prepare(
    'UPDATE products SET name=?, description=?, cost=?, price=?, units=? WHERE id=?'
  ).run(
    name ?? existing.name,
    description ?? existing.description,
    cost ?? existing.cost,
    price ?? existing.price,
    units ?? existing.units,
    req.params.id
  );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json(product);
});

export default router;
