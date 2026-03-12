import { Router } from 'express';
import { getDb } from '../db/database';
import { requireOpenRegister } from '../middleware/requireOpenRegister';

const router = Router();

router.post('/orders', requireOpenRegister, (req, res) => {
  const db = getDb();
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { items } = req.body as { items: { product_id: number; quantity: number }[] };

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'items are required' });
  }

  // Validate stock
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as { id: number; name: string; units: number; price: number; cost: number } | undefined;
    if (!product) return res.status(404).json({ error: `Product ${item.product_id} not found` });
    if (product.units < item.quantity) {
      return res.status(409).json({ error: `Insufficient stock for product '${product.name}': requested ${item.quantity}, available ${product.units}` });
    }
  }

  db.exec('BEGIN');
  let order;
  try {
    const orderResult = db.prepare(
      "INSERT INTO orders (session_id, status, created_at) VALUES (?, 'pending', datetime('now'))"
    ).run(sessionId);
    const orderId = orderResult.lastInsertRowid as number;

    let total = 0;
    const insertedItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as { id: number; price: number; cost: number };
      const subtotal = product.price * item.quantity;
      total += subtotal;
      const itemResult = db.prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(orderId, item.product_id, item.quantity, product.price, product.cost, subtotal);
      db.prepare('UPDATE products SET units = units - ? WHERE id = ?').run(item.quantity, item.product_id);
      insertedItems.push(db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemResult.lastInsertRowid));
    }

    db.prepare('UPDATE orders SET total = ? WHERE id = ?').run(total, orderId);
    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
    order = { ...orderRow, items: insertedItems };
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.status(201).json(order);
});

router.post('/orders/:id/pay', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as { id: number; status: string; total: number; session_id: number } | undefined;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'paid') return res.status(409).json({ error: 'Order already paid' });

  const { payment_method, amount_received } = req.body as { payment_method: string; amount_received?: number };
  if (!payment_method) return res.status(400).json({ error: 'payment_method is required' });

  if (payment_method === 'cash') {
    if (amount_received == null) return res.status(400).json({ error: 'amount_received is required for cash payments' });
    if (amount_received < order.total) {
      return res.status(400).json({ error: `Insufficient payment: received ${amount_received.toFixed(2)}, total is ${order.total.toFixed(2)}` });
    }
  }

  const account = payment_method === 'card' ? 'credit_card' : 'cash';
  const changeDue = payment_method === 'cash' ? (amount_received! - order.total) : null;

  db.prepare(
    "UPDATE orders SET status = 'paid', payment_method = ?, amount_received = ?, change_due = ?, paid_at = datetime('now') WHERE id = ?"
  ).run(payment_method === 'card' ? 'card' : payment_method, amount_received ?? null, changeDue, order.id);

  db.prepare(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('sale', ?, ?, ?, ?, 'order')"
  ).run(account, order.total, `Order #${order.id} paid with ${payment_method}`, order.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json(updated);
});

router.get('/orders/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  res.json({ ...(order as object), items });
});

export default router;
