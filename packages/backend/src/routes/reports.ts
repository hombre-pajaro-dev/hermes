import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/sales-by-item', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.id as product_id, p.name,
           SUM(oi.quantity) as units_sold,
           SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'paid' AND DATE(o.paid_at) = ?
    GROUP BY p.id
    UNION ALL
    SELECT p.id, p.name,
           SUM(ti.quantity),
           SUM(ti.subtotal),
           SUM(ti.quantity * ti.unit_cost)
    FROM tab_items ti
    JOIN tabs t ON t.id = ti.tab_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.status = 'paid' AND DATE(t.paid_at) = ?
    GROUP BY p.id
  `).all(date, date) as { product_id: number; name: string; units_sold: number; revenue: number; cost: number }[];

  // Merge duplicates
  const merged = new Map<number, typeof rows[0]>();
  for (const row of rows) {
    const ex = merged.get(row.product_id);
    if (ex) {
      ex.units_sold += row.units_sold;
      ex.revenue += row.revenue;
      ex.cost += row.cost;
    } else {
      merged.set(row.product_id, { ...row });
    }
  }
  res.json(Array.from(merged.values()));
});

router.get('/daily-total', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const db = getDb();
  const orders = db.prepare(
    "SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as total_sales FROM orders WHERE status = 'paid' AND DATE(paid_at) = ?"
  ).get(date) as { order_count: number; total_sales: number };

  const costRow = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as total_cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid' AND DATE(o.paid_at) = ?
  `).get(date) as { total_cost: number };

  res.json({
    date,
    order_count: orders.order_count,
    total_sales: orders.total_sales,
    total_cost: costRow.total_cost,
  });
});

router.get('/close-brief', (req, res) => {
  const db = getDb();
  let sessionId: number;
  if (req.query.session_id) {
    sessionId = Number(req.query.session_id);
  } else {
    const s = db.prepare("SELECT id FROM register_sessions ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    if (!s) return res.status(404).json({ error: 'No session found' });
    sessionId = s.id;
  }

  const byItem = db.prepare(`
    SELECT p.id as product_id, p.name,
           SUM(oi.quantity) as units_sold,
           SUM(oi.subtotal) as revenue,
           SUM(oi.quantity * oi.unit_cost) as cost,
           SUM(oi.subtotal - oi.quantity * oi.unit_cost) as profit
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.session_id = ? AND o.status = 'paid'
    GROUP BY p.id
    UNION ALL
    SELECT p.id, p.name,
           SUM(ti.quantity),
           SUM(ti.subtotal),
           SUM(ti.quantity * ti.unit_cost),
           SUM(ti.subtotal - ti.quantity * ti.unit_cost)
    FROM tab_items ti
    JOIN tabs t ON t.id = ti.tab_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.session_id = ? AND t.status = 'paid'
    GROUP BY p.id
  `).all(sessionId, sessionId) as { product_id: number; name: string; units_sold: number; revenue: number; cost: number; profit: number }[];

  const merged = new Map<number, typeof byItem[0]>();
  for (const row of byItem) {
    const ex = merged.get(row.product_id);
    if (ex) {
      ex.units_sold += row.units_sold;
      ex.revenue += row.revenue;
      ex.cost += row.cost;
      ex.profit += row.profit;
    } else {
      merged.set(row.product_id, { ...row });
    }
  }
  const items = Array.from(merged.values());
  const revenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalCost = items.reduce((s, i) => s + i.cost, 0);
  const mostSold = [...items].sort((a, b) => b.units_sold - a.units_sold)[0] ?? null;
  const mostProfitable = [...items].sort((a, b) => b.profit - a.profit)[0] ?? null;

  res.json({
    session_id: sessionId,
    revenue,
    total_cost: totalCost,
    gross_profit: revenue - totalCost,
    most_sold: mostSold ? { product_id: mostSold.product_id, name: mostSold.name, units_sold: mostSold.units_sold } : null,
    most_profitable: mostProfitable ? { product_id: mostProfitable.product_id, name: mostProfitable.name, profit: mostProfitable.profit } : null,
    by_item: items,
  });
});

router.get('/daily-range', (req, res) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  const db = getDb();

  const days: { date: string; revenue: number; cost: number; order_count: number }[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const row = db.prepare(
      "SELECT COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE status = 'paid' AND DATE(paid_at) = ?"
    ).get(dateStr) as { order_count: number; revenue: number };
    const costRow = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0) as cost
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid' AND DATE(o.paid_at) = ?
    `).get(dateStr) as { cost: number };
    days.push({ date: dateStr, revenue: row.revenue, cost: costRow.cost, order_count: row.order_count });
    current.setDate(current.getDate() + 1);
  }

  res.json(days);
});

export default router;
