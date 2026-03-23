import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.get('/sales-by-item', async (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const db = await getDb();
  const { rows } = await db.query<{ product_id: number; name: string; units_sold: number; revenue: number; cost: number }>(`
    SELECT p.id as product_id, p.name,
           SUM(oi.quantity) as units_sold,
           SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'paid' AND o.paid_at::date = $1::date
    GROUP BY p.id, p.name
    UNION ALL
    SELECT p.id, p.name,
           SUM(ti.quantity),
           SUM(ti.subtotal),
           SUM(ti.quantity * ti.unit_cost)
    FROM tab_items ti
    JOIN tabs t ON t.id = ti.tab_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.status = 'paid' AND t.paid_at::date = $1::date
    GROUP BY p.id, p.name
  `, [date]);

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
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const db = await getDb();
  const { rows: [orders] } = await db.query(`
    SELECT
      COUNT(*)::int as order_count,
      COALESCE(SUM(total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales
    FROM orders WHERE status = 'paid' AND paid_at::date = $1::date
  `, [date]);
  const { rows: [costRow] } = await db.query(`
    SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as total_cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid' AND o.paid_at::date = $1::date
  `, [date]);
  res.json({
    date,
    order_count: orders.order_count,
    total_sales: Number(orders.total_sales),
    cash_sales: Number(orders.cash_sales),
    card_sales: Number(orders.card_sales),
    total_cost: Number(costRow.total_cost),
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

router.get('/daily-range', async (req, res) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  const db = await getDb();
  const days: { date: string; revenue: number; cost: number; order_count: number }[] = [];
  const current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const { rows: [row] } = await db.query(
      "SELECT COUNT(*)::int as order_count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE status = 'paid' AND paid_at::date = $1::date",
      [dateStr]
    );
    const { rows: [costRow] } = await db.query(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as cost
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid' AND o.paid_at::date = $1::date
    `, [dateStr]);
    days.push({ date: dateStr, revenue: Number(row.revenue), cost: Number(costRow.cost), order_count: row.order_count });
    current.setDate(current.getDate() + 1);
  }
  res.json(days);
});

export default router;
