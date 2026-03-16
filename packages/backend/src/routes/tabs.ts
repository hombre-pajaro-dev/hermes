import { Router } from 'express';
import { getDb, pool } from '../db/database';
import { requireOpenRegister } from '../middleware/requireOpenRegister';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query("SELECT * FROM tabs ORDER BY created_at DESC");
  res.json(rows);
});

router.get('/summary', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query("SELECT COUNT(*)::int as open_count, COALESCE(SUM(total), 0) as total_amount FROM tabs WHERE status = 'open'");
  res.json(rows[0]);
});

router.post('/', requireOpenRegister, async (req, res) => {
  const db = await getDb();
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { name = '', at_cost = false } = req.body;
  const { rows } = await db.query(
    "INSERT INTO tabs (session_id, name, status, at_cost, total, created_at) VALUES ($1, $2, 'open', $3, 0, NOW()) RETURNING *",
    [sessionId, name, at_cost ? 1 : 0]
  );
  res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Tab not found' });
  const { rows: items } = await db.query('SELECT * FROM tab_items WHERE tab_id = $1', [req.params.id]);
  res.json({ ...rows[0], items });
});

router.post('/:id/items', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  const tab = rows[0] as { id: number; status: string; at_cost: number; total: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });
  const { items } = req.body as { items: { product_id: number; quantity: number }[] };
  if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let additionalTotal = 0;
    for (const item of items) {
      const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      const unitPrice = tab.at_cost ? product.cost : product.price;
      const subtotal = unitPrice * item.quantity;
      additionalTotal += subtotal;
      const { rows: [existing] } = await client.query('SELECT id FROM tab_items WHERE tab_id = $1 AND product_id = $2', [tab.id, item.product_id]);
      if (existing) {
        await client.query('UPDATE tab_items SET quantity = quantity + $1, subtotal = subtotal + $2 WHERE id = $3', [item.quantity, subtotal, existing.id]);
      } else {
        await client.query('INSERT INTO tab_items (tab_id, product_id, quantity, unit_price, unit_cost, subtotal) VALUES ($1, $2, $3, $4, $5, $6)', [tab.id, item.product_id, item.quantity, unitPrice, product.cost, subtotal]);
      }
    }
    await client.query('UPDATE tabs SET total = total + $1 WHERE id = $2', [additionalTotal, tab.id]);
    await client.query('COMMIT');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    return res.status(404).json({ error: (err as Error).message });
  } finally {
    client.release();
  }

  const { rows: [updatedTab] } = await db.query('SELECT * FROM tabs WHERE id = $1', [tab.id]);
  const { rows: tabItems } = await db.query('SELECT * FROM tab_items WHERE tab_id = $1', [tab.id]);
  const itemCount = tabItems.reduce((sum, ti) => sum + Number(ti.quantity), 0);
  res.json({ ...updatedTab, item_count: itemCount, items: tabItems });
});

router.patch('/:id/items/:itemId', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  const tab = rows[0] as { id: number; status: string; total: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });

  const { rows: itemRows } = await db.query('SELECT * FROM tab_items WHERE id = $1 AND tab_id = $2', [req.params.itemId, req.params.id]);
  const item = itemRows[0] as { id: number; quantity: number; unit_price: number; subtotal: number } | undefined;
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { quantity } = req.body as { quantity: number };
  if (quantity == null || isNaN(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).json({ error: 'quantity must be >= 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oldSubtotal = Number(item.subtotal);
    const newSubtotal = Number(quantity) === 0 ? 0 : Number(item.unit_price) * Number(quantity);
    if (Number(quantity) === 0) {
      await client.query('DELETE FROM tab_items WHERE id = $1', [item.id]);
    } else {
      await client.query('UPDATE tab_items SET quantity = $1, subtotal = $2 WHERE id = $3', [Number(quantity), newSubtotal, item.id]);
    }
    await client.query('UPDATE tabs SET total = GREATEST(0, total - $1 + $2) WHERE id = $3', [oldSubtotal, newSubtotal, tab.id]);
    await client.query('COMMIT');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }

  const { rows: [updatedTab] } = await db.query('SELECT * FROM tabs WHERE id = $1', [tab.id]);
  const { rows: tabItems } = await db.query('SELECT * FROM tab_items WHERE tab_id = $1', [tab.id]);
  const itemCount = tabItems.reduce((sum: number, ti: { quantity: number }) => sum + Number(ti.quantity), 0);
  res.json({ ...updatedTab, item_count: itemCount, items: tabItems });
});

router.post('/:id/pay', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  const tab = rows[0] as { id: number; status: string; total: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });
  const { payment_method, amount_received } = req.body as { payment_method: string; amount_received?: number };
  if (!payment_method) return res.status(400).json({ error: 'payment_method is required' });
  if (payment_method === 'cash') {
    if (amount_received == null) return res.status(400).json({ error: 'amount_received is required for cash payments' });
    if (amount_received < tab.total) return res.status(400).json({ error: `Insufficient payment: received ${amount_received}, total is ${tab.total}` });
  }
  const account = payment_method === 'card' ? 'credit_card' : 'cash';
  const changeDue = payment_method === 'cash' ? (amount_received! - tab.total) : null;
  const { rows: [updated] } = await db.query(
    "UPDATE tabs SET status = 'paid', payment_method = $1, paid_at = NOW() WHERE id = $2 RETURNING *",
    [payment_method === 'card' ? 'credit_card' : payment_method, tab.id]
  );
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('tab_payment', $1, $2, $3, $4, 'tab')",
    [account, tab.total, `Tab #${tab.id} paid with ${payment_method}`, tab.id]
  );
  res.json({ ...updated, change_due: changeDue });
});

export default router;
