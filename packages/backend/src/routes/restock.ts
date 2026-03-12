import { Router } from 'express';
import { getDb, pool } from '../db/database';
import { requireOpenRegister } from '../middleware/requireOpenRegister';

const router = Router();

router.post('/', requireOpenRegister, async (req, res) => {
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { items } = req.body as { items: { product_id: number; quantity: number }[] };
  if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [orderRow] } = await client.query(
      "INSERT INTO restock_orders (session_id, created_at) VALUES ($1, NOW()) RETURNING *",
      [sessionId]
    );
    const restockId = orderRow.id;
    const resultItems = [];
    for (const item of items) {
      const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      await client.query('INSERT INTO restock_items (restock_order_id, product_id, quantity, unit_cost) VALUES ($1, $2, $3, $4)', [restockId, item.product_id, item.quantity, product.cost]);
      await client.query('UPDATE products SET units = units + $1 WHERE id = $2', [item.quantity, item.product_id]);
      const { rows: [updated] } = await client.query('SELECT units FROM products WHERE id = $1', [item.product_id]);
      resultItems.push({ product_id: item.product_id, name: product.name, quantity: item.quantity, new_units: updated.units });
    }
    await client.query(
      "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('restock', NULL, 0, 'Restock order', $1, 'restock')",
      [restockId]
    );
    await client.query('COMMIT');
    res.status(201).json({ id: restockId, session_id: sessionId, items: resultItems });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    res.status(404).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM restock_orders ORDER BY created_at DESC');
  res.json(rows);
});

export default router;
