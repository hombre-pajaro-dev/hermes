import { Router } from 'express';
import { getDb } from '../db/database';
import { requireOpenRegister } from '../middleware/requireOpenRegister';

const router = Router();

router.post('/adjust', requireOpenRegister, (req, res) => {
  const db = getDb();
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { adjustments } = req.body as { adjustments: { product_id: number; physical_count: number }[] };
  if (!adjustments || adjustments.length === 0) return res.status(400).json({ error: 'adjustments are required' });

  try {
    db.exec('BEGIN');
    const results = [];
    for (const adj of adjustments) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(adj.product_id) as { id: number; name: string; units: number; cost: number } | undefined;
      if (!product) throw new Error(`Product ${adj.product_id} not found`);
      const delta = adj.physical_count - product.units;
      db.prepare('UPDATE products SET units = ? WHERE id = ?').run(adj.physical_count, adj.product_id);
      const adjResult = db.prepare(
        "INSERT INTO inventory_adjustments (session_id, product_id, previous_units, physical_count, delta, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
      ).run(sessionId, adj.product_id, product.units, adj.physical_count, delta);
      const lossAmount = delta * product.cost;
      db.prepare(
        "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('adjustment', NULL, ?, ?, ?, 'adjustment')"
      ).run(lossAmount, `Inventory adjustment for ${product.name} (delta: ${delta})`, adjResult.lastInsertRowid);
      results.push({
        product_id: adj.product_id,
        name: product.name,
        previous_units: product.units,
        physical_count: adj.physical_count,
        delta,
        new_units: adj.physical_count,
      });
    }
    db.exec('COMMIT');
    res.status(201).json({ adjustments: results });
  } catch (err: unknown) {
    db.exec('ROLLBACK');
    res.status(404).json({ error: (err as Error).message });
  }
});

router.get('/adjustments', (_req, res) => {
  const adjustments = getDb().prepare('SELECT * FROM inventory_adjustments ORDER BY created_at DESC').all();
  res.json(adjustments);
});

export default router;
