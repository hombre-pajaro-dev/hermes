import { Router } from 'express';
import { getDb, pool } from '../db/database.js';
import { requireOpenRegister } from '../middleware/requireOpenRegister.js';

const router = Router();

router.post('/orders', requireOpenRegister, async (req, res) => {
  const db = await getDb();
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { items } = req.body as { items: { product_id: number; quantity: number }[] };
  if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

  for (const item of items) {
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
    const product = rows[0] as { id: number; name: string; units: number; price: number; cost: number } | undefined;
    if (!product) return res.status(404).json({ error: `Product ${item.product_id} not found` });
    if (product.units < item.quantity) return res.status(409).json({ error: `Insufficient stock for product '${product.name}': requested ${item.quantity}, available ${product.units}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [orderRow] } = await client.query(
      "INSERT INTO orders (session_id, status, created_at) VALUES ($1, 'pending', NOW()) RETURNING *",
      [sessionId]
    );
    const orderId = orderRow.id;
    let total = 0;
    const insertedItems = [];
    for (const item of items) {
      const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      const subtotal = product.price * item.quantity;
      total += subtotal;
      const { rows: [itemRow] } = await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, subtotal) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [orderId, item.product_id, item.quantity, product.price, product.cost, subtotal]
      );
      await client.query('UPDATE products SET units = units - $1 WHERE id = $2', [item.quantity, item.product_id]);
      insertedItems.push(itemRow);
    }
    const { rows: [updatedOrder] } = await client.query('UPDATE orders SET total = $1 WHERE id = $2 RETURNING *', [total, orderId]);
    await client.query('COMMIT');
    res.status(201).json({ ...updatedOrder, items: insertedItems });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.post('/orders/:id/pay', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const order = rows[0] as { id: number; status: string; total: number; session_id: number } | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'paid') return res.status(409).json({ error: 'Order already paid' });
  const { payment_method, amount_received } = req.body as { payment_method: string; amount_received?: number };
  if (!payment_method) return res.status(400).json({ error: 'payment_method is required' });
  if (payment_method === 'cash') {
    if (amount_received == null) return res.status(400).json({ error: 'amount_received is required for cash payments' });
    if (amount_received < order.total) return res.status(400).json({ error: `Insufficient payment: received ${amount_received.toFixed(2)}, total is ${order.total.toFixed(2)}` });
  }
  const account = payment_method === 'card' ? 'credit_card' : 'cash';
  const changeDue = payment_method === 'cash' ? (amount_received! - order.total) : null;
  const { rows: [updated] } = await db.query(
    "UPDATE orders SET status = 'paid', payment_method = $1, amount_received = $2, change_due = $3, paid_at = NOW() WHERE id = $4 RETURNING *",
    [payment_method === 'card' ? 'card' : payment_method, amount_received ?? null, changeDue, order.id]
  );
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('sale', $1, $2, $3, $4, 'order')",
    [account, order.total, `Order #${order.id} paid with ${payment_method}`, order.id]
  );
  res.json(updated);
});

router.get('/orders/:id', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
  const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
  res.json({ ...rows[0], items });
});

export default router;
