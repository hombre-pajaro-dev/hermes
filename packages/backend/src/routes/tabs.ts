import { Router } from 'express';
import { getDb, pool } from '../db/database.js';
import { isDiscountEligibleNow, computeDiscountAmount } from '../lib/discount-engine.js';
import { getProductAvailableUnits, deductProductStock, restoreProductStock } from '../lib/supply-utils.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { actorEmail } from '../lib/actor.js';
import { applyCardCommission } from '../lib/commission-utils.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query(`
    SELECT t.*,
      COALESCE(json_agg(
        json_build_object('id', ti.id, 'product_id', ti.product_id, 'name', p.name,
          'quantity', ti.quantity, 'unit_price', ti.unit_price, 'unit_cost', ti.unit_cost, 'subtotal', ti.subtotal,
          'added_by', ti.added_by, 'added_at', ti.added_at)
        ORDER BY ti.id
      ) FILTER (WHERE ti.id IS NOT NULL), '[]') AS items
    FROM tabs t
    LEFT JOIN tab_items ti ON ti.tab_id = t.id
    LEFT JOIN products p ON p.id = ti.product_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  res.json(rows);
});

router.get('/summary', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query("SELECT COUNT(*)::int as open_count, COALESCE(SUM(total), 0) as total_amount FROM tabs WHERE status = 'open'");
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const db = await getDb();
  const { rows: sessionRows } = await db.query(
    "SELECT id FROM register_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
  );
  if (!sessionRows[0]) return res.status(409).json({ error: 'Register is not open — open the register first' });
  const sessionId = sessionRows[0].id as number;
  const { name = '', at_cost = false } = req.body;
  const actor = actorEmail(req);
  const { rows } = await db.query(
    "INSERT INTO tabs (session_id, name, status, at_cost, total, created_at, updated_at, created_by) VALUES ($1, $2, 'open', $3, 0, NOW(), NOW(), $4) RETURNING *",
    [sessionId, name, at_cost ? 1 : 0, actor]
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

  // Stock check before opening the transaction
  for (const item of items) {
    const { rows: [product] } = await db.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
    if (!product) return res.status(404).json({ error: `Product ${item.product_id} not found` });
    const available = await getProductAvailableUnits(db, item.product_id);
    if (available < item.quantity) return res.status(409).json({ error: `Insufficient stock for '${product.name}': requested ${item.quantity}, available ${available}` });
  }

  const actor = actorEmail(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let additionalTotal = 0;
    for (const item of items) {
      const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      const unitPrice = tab.at_cost ? (product.staff_price ?? product.cost) : product.price;
      const subtotal = unitPrice * item.quantity;
      additionalTotal += subtotal;
      const { rows: [existing] } = await client.query('SELECT id FROM tab_items WHERE tab_id = $1 AND product_id = $2', [tab.id, item.product_id]);
      if (existing) {
        await client.query('UPDATE tab_items SET quantity = quantity + $1, subtotal = subtotal + $2 WHERE id = $3', [item.quantity, subtotal, existing.id]);
      } else {
        await client.query('INSERT INTO tab_items (tab_id, product_id, quantity, unit_price, unit_cost, subtotal, added_by, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())', [tab.id, item.product_id, item.quantity, unitPrice, product.cost, subtotal, actor]);
      }
      await deductProductStock(client, item.product_id, item.quantity);
    }
    await client.query('UPDATE tabs SET total = total + $1, updated_at = NOW() WHERE id = $2', [additionalTotal, tab.id]);
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

router.patch('/:id/items/:itemId', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  const tab = rows[0] as { id: number; status: string; total: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });

  const { rows: itemRows } = await db.query('SELECT * FROM tab_items WHERE id = $1 AND tab_id = $2', [req.params.itemId, req.params.id]);
  const item = itemRows[0] as { id: number; product_id: number; quantity: number; unit_price: number; subtotal: number } | undefined;
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { quantity } = req.body as { quantity: number };
  if (quantity == null || isNaN(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).json({ error: 'quantity must be >= 0' });
  }

  const newQty = Number(quantity);
  const oldQty = Number(item.quantity);
  const qtyDelta = newQty - oldQty; // positive = more units needed, negative = units restored

  if (qtyDelta > 0) {
    const { rows: [product] } = await db.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
    const available = await getProductAvailableUnits(db, item.product_id);
    if (available < qtyDelta) {
      return res.status(409).json({ error: `Insufficient stock for '${product.name}': requested ${qtyDelta} more, available ${available}` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oldSubtotal = Number(item.subtotal);
    const newSubtotal = newQty === 0 ? 0 : Number(item.unit_price) * newQty;
    if (newQty === 0) {
      await client.query('DELETE FROM tab_items WHERE id = $1', [item.id]);
    } else {
      await client.query('UPDATE tab_items SET quantity = $1, subtotal = $2 WHERE id = $3', [newQty, newSubtotal, item.id]);
    }
    await client.query('UPDATE tabs SET total = GREATEST(0, total - $1 + $2), updated_at = NOW() WHERE id = $3', [oldSubtotal, newSubtotal, tab.id]);
    if (qtyDelta !== 0) {
      if (qtyDelta > 0) {
        await deductProductStock(client, item.product_id, qtyDelta);
      } else {
        await restoreProductStock(client, item.product_id, -qtyDelta);
      }
    }
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

router.post('/:id/void', requireAdmin, async (req, res) => {
  const db = await getDb();
  const actor = actorEmail(req);
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  const tab = rows[0] as { id: number; status: string; total: number; session_id: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });
  const { rows: [updated] } = await db.query(
    "UPDATE tabs SET status = 'voided', updated_at = NOW() WHERE id = $1 RETURNING *",
    [tab.id]
  );
  if (tab.total > 0) {
    await db.query(
      "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type, created_by, session_id) VALUES ('tab_writeoff', 'expense', $1, $2, $3, 'tab', $4, $5)",
      [-tab.total, `Write-off: Tab #${tab.id}`, tab.id, actor, tab.session_id]
    );
  }
  res.json(updated);
});

router.post('/:id/pay', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM tabs WHERE id = $1', [req.params.id]);
  const tab = rows[0] as { id: number; status: string; total: number; at_cost: number } | undefined;
  if (!tab) return res.status(404).json({ error: 'Tab not found' });
  if (tab.status !== 'open') return res.status(409).json({ error: 'Tab is not open' });

  const { payment_method, amount_received, discount_id } = req.body as {
    payment_method: string; amount_received?: number; discount_id?: number;
  };
  if (!payment_method) return res.status(400).json({ error: 'payment_method is required' });

  // At-cost tabs are mutually exclusive with discounts
  if (discount_id && tab.at_cost) {
    return res.status(409).json({ error: 'Cannot apply a discount to a staff cost tab' });
  }

  // Resolve discount
  let discountAmount = 0;
  let discountRow: { id: number; name: string; type: string } | null = null;
  if (discount_id && !tab.at_cost) {
    const { rows: [d] } = await db.query('SELECT * FROM discounts WHERE id = $1', [discount_id]);
    if (!d) return res.status(404).json({ error: 'Discount not found' });
    if (!isDiscountEligibleNow(d)) return res.status(409).json({ error: 'Discount is not currently eligible' });
    const { rows: dps } = await db.query('SELECT product_id FROM discount_products WHERE discount_id = $1', [discount_id]);
    const productIds = dps.map((dp: { product_id: number }) => dp.product_id);
    const { rows: items } = await db.query('SELECT * FROM tab_items WHERE tab_id = $1', [tab.id]);
    discountAmount = computeDiscountAmount(d, productIds, items);
    discountRow = d;
  }

  const { rows: [{ computed_total }] } = await db.query(
    'SELECT COALESCE(SUM(subtotal), 0) AS computed_total FROM tab_items WHERE tab_id = $1',
    [tab.id]
  );
  const effectiveTotal = Math.max(0, Number(computed_total) - discountAmount);

  if (payment_method === 'cash') {
    if (amount_received == null) return res.status(400).json({ error: 'amount_received is required for cash payments' });
    if (amount_received < effectiveTotal) return res.status(400).json({ error: `Insufficient payment: received ${amount_received}, total is ${effectiveTotal}` });
  }

  const account = payment_method === 'card' || payment_method === 'transfer' ? 'digital' : 'cash';
  const changeDue = payment_method === 'cash' ? (amount_received! - effectiveTotal) : null;
  const actor = actorEmail(req);

  const { rows: [updated] } = await db.query(
    "UPDATE tabs SET status = 'paid', payment_method = $1, discount_amount = $2, paid_at = NOW(), updated_at = NOW(), paid_by = $4 WHERE id = $3 RETURNING *",
    [payment_method, discountAmount, tab.id, actor],
  );
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type, created_by) VALUES ('tab_payment', $1, $2, $3, $4, 'tab', $5)",
    [account, effectiveTotal, `Tab #${tab.id} paid with ${payment_method}`, tab.id, actor],
  );

  if (discountRow && discountAmount > 0) {
    await db.query(
      'INSERT INTO applied_discounts (discount_id, tab_id, snapshot_name, snapshot_type, amount) VALUES ($1,$2,$3,$4,$5)',
      [discountRow.id, tab.id, discountRow.name, discountRow.type, discountAmount],
    );
    await db.query('UPDATE discounts SET redemptions = redemptions + 1 WHERE id = $1', [discountRow.id]);
  }

  if (payment_method === 'card' && effectiveTotal > 0) {
    await applyCardCommission(db, effectiveTotal, tab.id, 'tab', actor);
  }

  res.json({ ...updated, change_due: changeDue });
});

export default router;
