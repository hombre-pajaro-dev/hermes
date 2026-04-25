import { Router } from 'express';
import { getDb, pool } from '../db/database.js';
import { requireOpenRegister } from '../middleware/requireOpenRegister.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { productUsesSupplies } from '../lib/supply-utils.js';

const router = Router();

router.post('/', requireAdmin, requireOpenRegister, async (req, res) => {
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { items, provider_id, payment_account } = req.body as {
    items: { product_id: number; quantity: number; unit_cost?: number | null }[];
    provider_id?: number | null;
    payment_account?: string | null;
  };
  if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let providerName: string | null = null;
    if (provider_id) {
      const { rows } = await client.query('SELECT name FROM providers WHERE id = $1', [provider_id]);
      providerName = rows[0]?.name ?? null;
    }

    // First pass: calculate total and validate
    let totalPayment = 0;
    const { rows: [orderRow] } = await client.query(
      `INSERT INTO restock_orders (session_id, provider_id, payment_account, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [sessionId, provider_id ?? null, payment_account ?? null]
    );
    const restockId = orderRow.id;
    const resultItems = [];

    for (const item of items) {
      const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      const usesSupplies = await productUsesSupplies(client, item.product_id);
      if (usesSupplies) throw new Error(`'${product.name}' is supply-based — restock it via its supplies instead`);
      if (product.track_inventory === false) throw new Error(`'${product.name}' has inventory tracking disabled`);

      const previousCost: number = product.cost;
      const newCost: number = (item.unit_cost != null && item.unit_cost > 0) ? item.unit_cost : previousCost;

      if (newCost !== previousCost) {
        await client.query('UPDATE products SET cost = $1 WHERE id = $2', [newCost, item.product_id]);
      }

      await client.query(
        'INSERT INTO restock_items (restock_order_id, product_id, quantity, unit_cost, previous_cost) VALUES ($1, $2, $3, $4, $5)',
        [restockId, item.product_id, item.quantity, newCost, previousCost]
      );
      await client.query('UPDATE products SET units = units + $1 WHERE id = $2', [item.quantity, item.product_id]);
      const { rows: [updated] } = await client.query('SELECT units FROM products WHERE id = $1', [item.product_id]);

      totalPayment += item.quantity * newCost;
      resultItems.push({
        product_id: item.product_id,
        name: product.name,
        quantity: item.quantity,
        unit_cost: newCost,
        previous_cost: previousCost,
        cost_changed: newCost !== previousCost,
        new_units: updated.units,
      });
    }

    // Store calculated total on the order
    await client.query('UPDATE restock_orders SET payment_amount = $1 WHERE id = $2', [totalPayment, restockId]);

    const ledgerAmount = totalPayment > 0 ? -totalPayment : 0;
    const ledgerAccount = totalPayment > 0 ? (payment_account ?? null) : null;
    const ledgerDesc = providerName ? `Restock from ${providerName}` : 'Restock order';
    await client.query(
      "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('restock', $1, $2, $3, $4, 'restock')",
      [ledgerAccount, ledgerAmount, ledgerDesc, restockId]
    );

    await client.query('COMMIT');
    res.status(201).json({
      id: restockId,
      session_id: sessionId,
      provider_id: provider_id ?? null,
      payment_amount: totalPayment,
      payment_account: payment_account ?? null,
      items: resultItems,
    });
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
