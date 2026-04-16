import { Router } from 'express';
import { getDb, pool } from '../db/database.js';
import { requireOpenRegister } from '../middleware/requireOpenRegister.js';
import { productUsesSupplies } from '../lib/supply-utils.js';

const router = Router();

router.post('/adjust', requireOpenRegister, async (req, res) => {
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { adjustments } = req.body as { adjustments: { product_id: number; physical_count: number }[] };
  if (!adjustments || adjustments.length === 0) return res.status(400).json({ error: 'adjustments are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const adj of adjustments) {
      const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [adj.product_id]);
      if (!product) throw new Error(`Product ${adj.product_id} not found`);
      const usesSupplies = await productUsesSupplies(client, adj.product_id);
      if (usesSupplies) throw new Error(`'${product.name}' is supply-based — adjust its supplies directly instead`);
      const delta = adj.physical_count - product.units;
      await client.query('UPDATE products SET units = $1 WHERE id = $2', [adj.physical_count, adj.product_id]);
      const { rows: [adjRow] } = await client.query(
        "INSERT INTO inventory_adjustments (session_id, product_id, previous_units, physical_count, delta, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *",
        [sessionId, adj.product_id, product.units, adj.physical_count, delta]
      );
      await client.query(
        "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('adjustment', NULL, $1, $2, $3, 'adjustment')",
        [delta * product.cost, `Inventory adjustment for ${product.name} (delta: ${delta})`, adjRow.id]
      );
      results.push({ product_id: adj.product_id, name: product.name, previous_units: product.units, physical_count: adj.physical_count, delta, new_units: adj.physical_count });
    }
    await client.query('COMMIT');
    res.status(201).json({ adjustments: results });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    res.status(404).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

router.get('/adjustments', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM inventory_adjustments ORDER BY created_at DESC');
  res.json(rows);
});

export default router;
