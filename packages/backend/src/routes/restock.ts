import { Router } from 'express';
import { getDb } from '../db/database';
import { requireOpenRegister } from '../middleware/requireOpenRegister';

const router = Router();

router.post('/', requireOpenRegister, (req, res) => {
  const db = getDb();
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { items } = req.body as { items: { product_id: number; quantity: number }[] };
  if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

  try {
    db.exec('BEGIN');
    const orderResult = db.prepare(
      "INSERT INTO restock_orders (session_id, created_at) VALUES (?, datetime('now'))"
    ).run(sessionId);
    const restockId = orderResult.lastInsertRowid as number;

    const resultItems = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as { id: number; name: string; units: number; cost: number } | undefined;
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      db.prepare('INSERT INTO restock_items (restock_order_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)').run(restockId, item.product_id, item.quantity, product.cost);
      db.prepare('UPDATE products SET units = units + ? WHERE id = ?').run(item.quantity, item.product_id);
      const updated = db.prepare('SELECT units FROM products WHERE id = ?').get(item.product_id) as { units: number };
      resultItems.push({ product_id: item.product_id, name: product.name, quantity: item.quantity, new_units: updated.units });
    }

    db.prepare(
      "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('restock', NULL, 0, 'Restock order', ?, 'restock')"
    ).run(restockId);

    db.exec('COMMIT');
    res.status(201).json({ id: restockId, session_id: sessionId, items: resultItems });
  } catch (err: unknown) {
    db.exec('ROLLBACK');
    res.status(404).json({ error: (err as Error).message });
  }
});

router.get('/', (_req, res) => {
  const orders = getDb().prepare('SELECT * FROM restock_orders ORDER BY created_at DESC').all();
  res.json(orders);
});

export default router;
