import { Router } from 'express';
import { getDb } from '../db/database';
import { requireOpenRegister } from '../middleware/requireOpenRegister';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const tabs = db.prepare("SELECT * FROM tabs ORDER BY created_at DESC").all();
  res.json(tabs);
});

router.get('/summary', (_req, res) => {
  const db = getDb();
  const result = db.prepare("SELECT COUNT(*) as open_count, COALESCE(SUM(total), 0) as total_amount FROM tabs WHERE status = 'open'").get() as { open_count: number; total_amount: number };
  res.json(result);
});

router.post('/', requireOpenRegister, (req, res) => {
  const db = getDb();
  const sessionId = (req as typeof req & { sessionId: number }).sessionId;
  const { name = '', at_cost = false } = req.body;
  const result = db.prepare(
    "INSERT INTO tabs (session_id, name, status, at_cost, total, created_at) VALUES (?, ?, 'open', ?, 0, datetime('now'))"
  ).run(sessionId, name, at_cost ? 1 : 0);
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tab);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(req.params.id);
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  const items = db.prepare('SELECT * FROM tab_items WHERE tab_id = ?').all(req.params.id);
  res.json({ ...(tab as object), items });
});

router.post('/:id/items', (req, res) => {
  const db = getDb();
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(req.params.id) as { id: number; status: string; at_cost: number; total: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });

  const { items } = req.body as { items: { product_id: number; quantity: number }[] };
  if (!items || items.length === 0) return res.status(400).json({ error: 'items are required' });

  const addItems = db.transaction(() => {
    let additionalTotal = 0;
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as { id: number; price: number; cost: number } | undefined;
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      const unitPrice = tab.at_cost ? product.cost : product.price;
      const subtotal = unitPrice * item.quantity;
      additionalTotal += subtotal;
      const existing = db.prepare('SELECT id FROM tab_items WHERE tab_id = ? AND product_id = ?').get(tab.id, item.product_id) as { id: number } | undefined;
      if (existing) {
        db.prepare('UPDATE tab_items SET quantity = quantity + ?, subtotal = subtotal + ? WHERE id = ?')
          .run(item.quantity, subtotal, existing.id);
      } else {
        db.prepare('INSERT INTO tab_items (tab_id, product_id, quantity, unit_price, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
          .run(tab.id, item.product_id, item.quantity, unitPrice, product.cost, subtotal);
      }
    }
    db.prepare('UPDATE tabs SET total = total + ? WHERE id = ?').run(additionalTotal, tab.id);
  });

  try {
    addItems();
  } catch (err: unknown) {
    return res.status(404).json({ error: (err as Error).message });
  }

  const updatedTab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(tab.id) as Record<string, unknown>;
  const tabItems = db.prepare('SELECT * FROM tab_items WHERE tab_id = ?').all(tab.id);
  const itemCount = tabItems.reduce((sum: number, ti) => sum + ((ti as { quantity: number }).quantity), 0);
  res.json({ ...updatedTab, item_count: itemCount, items: tabItems });
});

router.post('/:id/pay', (req, res) => {
  const db = getDb();
  const tab = db.prepare('SELECT * FROM tabs WHERE id = ?').get(req.params.id) as { id: number; status: string; total: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });

  const { payment_method, amount_received } = req.body as { payment_method: string; amount_received?: number };
  if (!payment_method) return res.status(400).json({ error: 'payment_method is required' });

  if (payment_method === 'cash') {
    if (amount_received == null) return res.status(400).json({ error: 'amount_received is required for cash payments' });
    if (amount_received < tab.total) {
      return res.status(400).json({ error: `Insufficient payment: received ${amount_received}, total is ${tab.total}` });
    }
  }

  const account = payment_method === 'card' ? 'credit_card' : 'cash';
  const changeDue = payment_method === 'cash' ? (amount_received! - tab.total) : null;

  db.prepare(
    "UPDATE tabs SET status = 'paid', payment_method = ?, paid_at = datetime('now') WHERE id = ?"
  ).run(payment_method === 'card' ? 'credit_card' : payment_method, tab.id);

  db.prepare(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('tab_payment', ?, ?, ?, ?, 'tab')"
  ).run(account, tab.total, `Tab #${tab.id} paid with ${payment_method}`, tab.id);

  const updated = db.prepare('SELECT * FROM tabs WHERE id = ?').get(tab.id) as Record<string, unknown>;
  res.json({ ...updated, change_due: changeDue });
});

export default router;
