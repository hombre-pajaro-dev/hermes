import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

async function getOpenSession() {
  const db = await getDb();
  const { rows } = await db.query("SELECT * FROM register_sessions WHERE status = 'open' LIMIT 1");
  return rows[0] as { id: number; status: string; opening_cash: number; closing_cash?: number; opened_at: string; closed_at?: string } | undefined;
}

async function captureInventorySnapshot(db: Awaited<ReturnType<typeof getDb>>) {
  const { rows: products } = await db.query("SELECT id, name, units FROM products WHERE active = true ORDER BY name");
  const { rows: supplies } = await db.query("SELECT id, name, unit, quantity FROM supplies ORDER BY name");
  return { products, supplies };
}

router.get('/session', async (_req, res) => {
  const session = await getOpenSession();
  res.json(session ?? null);
});

router.get('/sessions', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query(
    'SELECT id, status, opening_cash, closing_cash, opened_at, closed_at FROM register_sessions ORDER BY opened_at DESC'
  );
  res.json(rows.map(r => ({
    id: r.id,
    status: r.status,
    opening_cash: Number(r.opening_cash),
    closing_cash: r.closing_cash != null ? Number(r.closing_cash) : null,
    opened_at: r.opened_at,
    closed_at: r.closed_at ?? null,
  })));
});

router.get('/sessions/:id/report', async (req, res) => {
  const db = await getDb();
  const sessionId = Number(req.params.id);
  const { rows: [session] } = await db.query('SELECT * FROM register_sessions WHERE id = $1', [sessionId]);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { rows: byItem } = await db.query<{ product_id: number; name: string; units_sold: number; revenue: number; cost: number; profit: number }>(`
    SELECT p.id as product_id, p.name,
           SUM(oi.quantity) as units_sold,
           SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost,
           SUM(oi.subtotal - oi.quantity * oi.unit_cost) as profit
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.session_id = $1 AND o.status = 'paid'
    GROUP BY p.id, p.name
    ORDER BY SUM(oi.subtotal) DESC
  `, [sessionId]);

  const { rows: [totals] } = await db.query(`
    SELECT COUNT(*)::int as order_count,
           COALESCE(SUM(total), 0) as revenue,
           COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
           COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales
    FROM orders WHERE session_id = $1 AND status = 'paid'
  `, [sessionId]);

  const { rows: [costRow] } = await db.query(`
    SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as total_cost
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.session_id = $1 AND o.status = 'paid'
  `, [sessionId]);

  const { rows: cashouts } = await db.query(
    'SELECT id, amount, reason, created_at FROM cashouts WHERE session_id = $1 ORDER BY created_at',
    [sessionId]
  );

  const { rows: restocked } = await db.query(`
    SELECT p.id as product_id, p.name, SUM(ri.quantity) as units_restocked
    FROM restock_items ri
    JOIN restock_orders ro ON ro.id = ri.restock_order_id
    JOIN products p ON p.id = ri.product_id
    WHERE ro.session_id = $1
    GROUP BY p.id, p.name
  `, [sessionId]);

  const { rows: adjustments } = await db.query(`
    SELECT p.id as product_id, p.name, SUM(ia.delta) as delta
    FROM inventory_adjustments ia
    JOIN products p ON p.id = ia.product_id
    WHERE ia.session_id = $1
    GROUP BY p.id, p.name
  `, [sessionId]);

  res.json({
    session: {
      id: session.id,
      status: session.status,
      opening_cash: Number(session.opening_cash),
      closing_cash: session.closing_cash != null ? Number(session.closing_cash) : null,
      opened_at: session.opened_at,
      closed_at: session.closed_at ?? null,
      inventory_snapshot_open: session.inventory_snapshot_open ?? null,
      inventory_snapshot_close: session.inventory_snapshot_close ?? null,
    },
    order_count: totals.order_count,
    revenue: Number(totals.revenue),
    total_cost: Number(costRow.total_cost),
    gross_profit: Number(totals.revenue) - Number(costRow.total_cost),
    cash_sales: Number(totals.cash_sales),
    card_sales: Number(totals.card_sales),
    by_item: byItem.map(r => ({
      product_id: r.product_id, name: r.name,
      units_sold: Number(r.units_sold), revenue: Number(r.revenue),
      cost: Number(r.cost), profit: Number(r.profit),
    })),
    cashouts: cashouts.map(c => ({ id: c.id, amount: Number(c.amount), reason: c.reason, created_at: c.created_at })),
    restocked: restocked.map(r => ({ product_id: r.product_id, name: r.name, units_restocked: Number(r.units_restocked) })),
    adjustments: adjustments.map(a => ({ product_id: a.product_id, name: a.name, delta: Number(a.delta) })),
  });
});

router.post('/open', async (req, res) => {
  const existing = await getOpenSession();
  if (existing) return res.status(409).json({ error: 'Register is already open' });
  const { opening_cash } = req.body;
  if (opening_cash == null) return res.status(400).json({ error: 'opening_cash is required' });
  const db = await getDb();
  const snapshot = await captureInventorySnapshot(db);
  const { rows } = await db.query(
    "INSERT INTO register_sessions (opening_cash, status, opened_at, inventory_snapshot_open) VALUES ($1, 'open', NOW(), $2) RETURNING *",
    [opening_cash, JSON.stringify(snapshot)]
  );
  const session = rows[0];
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('register_open', 'cash', $1, 'Register opened', $2, 'session')",
    [opening_cash, session.id]
  );
  res.status(201).json(session);
});

router.post('/cashout', async (req, res) => {
  const session = await getOpenSession();
  if (!session) return res.status(403).json({ error: 'Register is not open' });
  const { amount, reason = '' } = req.body;
  if (amount == null) return res.status(400).json({ error: 'amount is required' });
  const db = await getDb();
  const { rows } = await db.query(
    "INSERT INTO cashouts (session_id, amount, reason, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
    [session.id, amount, reason]
  );
  const cashout = rows[0];
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('cashout', 'cash', $1, $2, $3, 'cashout')",
    [-amount, `Cashout: ${reason}`, cashout.id]
  );
  res.status(201).json(cashout);
});

router.post('/close', async (req, res) => {
  const session = await getOpenSession();
  if (!session) return res.status(403).json({ error: 'Register is not open' });
  const { closing_cash } = req.body;
  if (closing_cash == null) return res.status(400).json({ error: 'closing_cash is required' });
  const db = await getDb();
  const snapshot = await captureInventorySnapshot(db);
  await db.query(
    "UPDATE register_sessions SET status = 'closed', closing_cash = $1, closed_at = NOW(), inventory_snapshot_close = $2 WHERE id = $3",
    [closing_cash, JSON.stringify(snapshot), session.id]
  );
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('register_close', 'cash', $1, 'Register closed', $2, 'session')",
    [-closing_cash, session.id]
  );
  const { rows } = await db.query('SELECT * FROM register_sessions WHERE id = $1', [session.id]);
  res.json(rows[0]);
});

router.get('/close-brief', async (req, res) => {
  const db = await getDb();
  let sessionId: number;
  if (req.query.session_id) {
    sessionId = Number(req.query.session_id);
  } else {
    const { rows } = await db.query("SELECT id FROM register_sessions ORDER BY id DESC LIMIT 1");
    if (!rows[0]) return res.status(404).json({ error: 'No session found' });
    sessionId = rows[0].id;
  }
  const { rows: byItem } = await db.query<{ product_id: number; name: string; units_sold: number; revenue: number; cost: number; profit: number }>(`
    SELECT p.id as product_id, p.name,
           SUM(oi.quantity) as units_sold,
           SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost,
           SUM(oi.subtotal - oi.quantity * oi.unit_cost) as profit
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.session_id = $1 AND o.status = 'paid'
    GROUP BY p.id, p.name
    UNION ALL
    SELECT p.id, p.name,
           SUM(ti.quantity),
           SUM(ti.subtotal),
           SUM(ti.quantity * ti.unit_cost),
           SUM(ti.subtotal - ti.quantity * ti.unit_cost)
    FROM tab_items ti
    JOIN tabs t ON t.id = ti.tab_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.session_id = $1 AND t.status = 'paid'
    GROUP BY p.id, p.name
  `, [sessionId]);

  const merged = new Map<number, typeof byItem[0]>();
  for (const row of byItem) {
    const existing = merged.get(row.product_id);
    if (existing) {
      existing.units_sold = Number(existing.units_sold) + Number(row.units_sold);
      existing.revenue = Number(existing.revenue) + Number(row.revenue);
      existing.cost = Number(existing.cost) + Number(row.cost);
      existing.profit = Number(existing.profit) + Number(row.profit);
    } else {
      merged.set(row.product_id, { ...row, units_sold: Number(row.units_sold), revenue: Number(row.revenue), cost: Number(row.cost), profit: Number(row.profit) });
    }
  }
  const items = Array.from(merged.values());
  const revenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalCost = items.reduce((s, i) => s + i.cost, 0);
  const mostSold = items.sort((a, b) => b.units_sold - a.units_sold)[0] ?? null;
  const mostProfitable = [...items].sort((a, b) => b.profit - a.profit)[0] ?? null;
  res.json({
    session_id: sessionId, revenue, total_cost: totalCost, gross_profit: revenue - totalCost,
    most_sold: mostSold ? { product_id: mostSold.product_id, name: mostSold.name, units_sold: mostSold.units_sold } : null,
    most_profitable: mostProfitable ? { product_id: mostProfitable.product_id, name: mostProfitable.name, profit: mostProfitable.profit } : null,
    by_item: items,
  });
});

export default router;
