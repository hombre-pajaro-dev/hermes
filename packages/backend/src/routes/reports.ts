import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/sales-by-item', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const fallback = (req.query.date as string) || todayLocal;
  const from = (req.query.from as string) || fallback;
  const to = (req.query.to as string) || fallback;
  const db = await getDb();
  const { rows } = await db.query<{ product_id: number; name: string; units_sold: number; revenue: number; cost: number }>(`
    SELECT p.id as product_id, p.name,
           SUM(oi.quantity) as units_sold,
           SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'paid'
      AND (o.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
    GROUP BY p.id, p.name
    UNION ALL
    SELECT p.id, p.name,
           SUM(ti.quantity),
           SUM(ti.subtotal),
           SUM(ti.quantity * ti.unit_cost)
    FROM tab_items ti
    JOIN tabs t ON t.id = ti.tab_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.status = 'paid'
      AND (t.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
    GROUP BY p.id, p.name
  `, [from, to, tz]);

  const merged = new Map<number, { product_id: number; name: string; units_sold: number; revenue: number; cost: number }>();
  for (const row of rows) {
    const ex = merged.get(row.product_id);
    if (ex) {
      ex.units_sold = Number(ex.units_sold) + Number(row.units_sold);
      ex.revenue = Number(ex.revenue) + Number(row.revenue);
      ex.cost = Number(ex.cost) + Number(row.cost);
    } else {
      merged.set(row.product_id, { ...row, units_sold: Number(row.units_sold), revenue: Number(row.revenue), cost: Number(row.cost) });
    }
  }
  res.json(Array.from(merged.values()));
});

router.get('/daily-total', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const fallback = (req.query.date as string) || todayLocal;
  const from = (req.query.from as string) || fallback;
  const to = (req.query.to as string) || fallback;
  const db = await getDb();
  const { rows: [totals] } = await db.query(`
    SELECT
      COUNT(*)::int as order_count,
      COALESCE(SUM(total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales
    FROM (
      SELECT total, payment_method FROM orders
        WHERE status = 'paid' AND (paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
      UNION ALL
      SELECT total, payment_method FROM tabs
        WHERE status = 'paid' AND (paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
    ) combined
  `, [from, to, tz]);
  const { rows: [costRow] } = await db.query(`
    SELECT COALESCE(SUM(cost), 0) as total_cost FROM (
      SELECT SUM(oi.quantity * oi.unit_cost) as cost
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'paid' AND (o.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
      UNION ALL
      SELECT SUM(ti.quantity * ti.unit_cost)
        FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id
        WHERE t.status = 'paid' AND (t.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
    ) costs
  `, [from, to, tz]);
  const { rows: [adjRow] } = await db.query(`
    SELECT COALESCE(SUM(amount), 0) as inventory_adjustment_total
    FROM ledger_entries
    WHERE account = 'inventory_adjustment'
      AND (created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
  `, [from, to, tz]);
  res.json({
    date: from === to ? from : `${from}/${to}`,
    order_count: totals.order_count,
    total_sales: Number(totals.total_sales),
    cash_sales: Number(totals.cash_sales),
    card_sales: Number(totals.card_sales),
    total_cost: Number(costRow.total_cost),
    inventory_adjustment_total: Number(adjRow.inventory_adjustment_total),
  });
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
           SUM(oi.quantity) as units_sold, SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost,
           SUM(oi.subtotal - oi.quantity * oi.unit_cost) as profit
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
    WHERE o.session_id = $1 AND o.status = 'paid' GROUP BY p.id, p.name
    UNION ALL
    SELECT p.id, p.name, SUM(ti.quantity), SUM(ti.subtotal),
           SUM(ti.quantity * ti.unit_cost), SUM(ti.subtotal - ti.quantity * ti.unit_cost)
    FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id JOIN products p ON p.id = ti.product_id
    WHERE t.session_id = $1 AND t.status = 'paid' GROUP BY p.id, p.name
  `, [sessionId]);

  const merged = new Map<number, typeof byItem[0]>();
  for (const row of byItem) {
    const ex = merged.get(row.product_id);
    if (ex) {
      ex.units_sold = Number(ex.units_sold) + Number(row.units_sold);
      ex.revenue = Number(ex.revenue) + Number(row.revenue);
      ex.cost = Number(ex.cost) + Number(row.cost);
      ex.profit = Number(ex.profit) + Number(row.profit);
    } else {
      merged.set(row.product_id, { ...row, units_sold: Number(row.units_sold), revenue: Number(row.revenue), cost: Number(row.cost), profit: Number(row.profit) });
    }
  }
  const items = Array.from(merged.values());
  const revenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalCost = items.reduce((s, i) => s + i.cost, 0);
  const mostSold = [...items].sort((a, b) => b.units_sold - a.units_sold)[0] ?? null;
  const mostProfitable = [...items].sort((a, b) => b.profit - a.profit)[0] ?? null;
  res.json({
    session_id: sessionId, revenue, total_cost: totalCost, gross_profit: revenue - totalCost,
    most_sold: mostSold ? { product_id: mostSold.product_id, name: mostSold.name, units_sold: mostSold.units_sold } : null,
    most_profitable: mostProfitable ? { product_id: mostProfitable.product_id, name: mostProfitable.name, profit: mostProfitable.profit } : null,
    by_item: items,
  });
});

router.get('/top-products', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query<{ product_id: number; units_sold: number }>(`
    SELECT p.id as product_id,
           COALESCE(o.qty, 0) + COALESCE(t.qty, 0) as units_sold
    FROM products p
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders ord ON ord.id = oi.order_id
      WHERE ord.status = 'paid'
      GROUP BY oi.product_id
    ) o ON o.product_id = p.id
    LEFT JOIN (
      SELECT ti.product_id, SUM(ti.quantity) as qty
      FROM tab_items ti
      JOIN tabs tab ON tab.id = ti.tab_id
      WHERE tab.status = 'paid'
      GROUP BY ti.product_id
    ) t ON t.product_id = p.id
    ORDER BY units_sold DESC
  `);
  res.json(rows.map(r => ({ product_id: r.product_id, units_sold: Number(r.units_sold) })));
});

router.get('/daily-range', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const from = (req.query.from as string) || new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const to = (req.query.to as string) || new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const db = await getDb();
  const days: { date: string; revenue: number; cost: number; order_count: number }[] = [];
  const current = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const { rows: [row] } = await db.query(
      "SELECT COUNT(*)::int as order_count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE status = 'paid' AND (paid_at AT TIME ZONE $2)::date = $1::date",
      [dateStr, tz]
    );
    const { rows: [costRow] } = await db.query(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as cost
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid' AND (o.paid_at AT TIME ZONE $2)::date = $1::date
    `, [dateStr, tz]);
    const { rows: [adjRow] } = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as adjustment
      FROM ledger_entries
      WHERE account = 'inventory_adjustment'
        AND (created_at AT TIME ZONE $2)::date = $1::date
    `, [dateStr, tz]);
    days.push({ date: dateStr, revenue: Number(row.revenue), cost: Number(costRow.cost), order_count: row.order_count, adjustment: Number(adjRow.adjustment) });
    current.setDate(current.getDate() + 1);
  }
  res.json(days);
});

router.get('/inventory-adjustments', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const fallback = (req.query.date as string) || todayLocal;
  const from = (req.query.from as string) || fallback;
  const to = (req.query.to as string) || fallback;
  const db = await getDb();
  const { rows } = await db.query<{
    product_id: number; name: string;
    adjustment_count: number; total_delta: number; total_cost_impact: number;
  }>(`
    SELECT p.id as product_id, p.name,
           COUNT(*)::int as adjustment_count,
           SUM(ia.delta) as total_delta,
           SUM(le.amount) as total_cost_impact
    FROM ledger_entries le
    JOIN inventory_adjustments ia ON ia.id = le.ref_id
    JOIN products p ON p.id = ia.product_id
    WHERE le.account = 'inventory_adjustment'
      AND (le.created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
    GROUP BY p.id, p.name
    ORDER BY ABS(SUM(le.amount)) DESC
  `, [from, to, tz]);
  res.json(rows.map(r => ({
    product_id: r.product_id,
    name: r.name,
    adjustment_count: r.adjustment_count,
    total_delta: Number(r.total_delta),
    total_cost_impact: Number(r.total_cost_impact),
  })));
});

export default router;
