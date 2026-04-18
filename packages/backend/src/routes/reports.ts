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
  const days: { date: string; revenue: number; cost: number; order_count: number; adjustment?: number }[] = [];
  const current = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const { rows: [row] } = await db.query(`
      SELECT COUNT(*)::int as order_count, COALESCE(SUM(total), 0) as revenue FROM (
        SELECT total FROM orders WHERE status = 'paid' AND (paid_at AT TIME ZONE $2)::date = $1::date
        UNION ALL
        SELECT total FROM tabs   WHERE status = 'paid' AND (paid_at AT TIME ZONE $2)::date = $1::date
      ) combined
    `, [dateStr, tz]);
    const { rows: [costRow] } = await db.query(`
      SELECT COALESCE(SUM(cost), 0) AS cost FROM (
        SELECT SUM(oi.quantity * oi.unit_cost) AS cost
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE o.status = 'paid' AND (o.paid_at AT TIME ZONE $2)::date = $1::date
        UNION ALL
        SELECT SUM(ti.quantity * ti.unit_cost)
          FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id
          WHERE t.status = 'paid' AND (t.paid_at AT TIME ZONE $2)::date = $1::date
      ) costs
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

router.get('/by-weekday', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const db = await getDb();
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const year = parseInt((req.query.year as string) || todayLocal.slice(0, 4));
  const from = `${year}-01-01`;
  const to = todayLocal.startsWith(String(year)) ? todayLocal : `${year}-12-31`;

  const { rows } = await db.query<{
    dow: number; median_revenue: string; median_cost: string; median_profit: string; sample_days: number;
  }>(`
    WITH daily AS (
      SELECT
        EXTRACT(DOW FROM (paid_at AT TIME ZONE $3)::date)::int AS dow,
        (paid_at AT TIME ZONE $3)::date AS day,
        SUM(revenue)::numeric AS revenue,
        SUM(cost)::numeric AS cost
      FROM (
        SELECT o.paid_at, o.total AS revenue,
          COALESCE((SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id), 0) AS cost
        FROM orders o
        WHERE o.status = 'paid'
          AND (o.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
        UNION ALL
        SELECT t.paid_at, t.total AS revenue,
          COALESCE((SELECT SUM(quantity * unit_cost) FROM tab_items WHERE tab_id = t.id), 0) AS cost
        FROM tabs t
        WHERE t.status = 'paid'
          AND (t.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
      ) combined
      GROUP BY dow, day
    )
    SELECT
      dow,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue)::numeric AS median_revenue,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost)::numeric AS median_cost,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue - cost)::numeric AS median_profit,
      COUNT(*)::int AS sample_days
    FROM daily
    GROUP BY dow
    ORDER BY dow
  `, [from, to, tz]);

  const dataMap = new Map(rows.map(r => [r.dow, r]));

  // ISO order: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) Sat(6) Sun(0)
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const periods = DOW_ORDER.map((dow, i) => {
    const r = dataMap.get(dow);
    return {
      label: DOW_LABELS[i],
      dow,
      median_revenue: r ? Number(r.median_revenue) : 0,
      median_cost: r ? Number(r.median_cost) : 0,
      median_profit: r ? Number(r.median_profit) : 0,
      sample_days: r ? r.sample_days : 0,
    };
  });

  const bestIndex = periods.reduce((best, p, i) => p.median_revenue > periods[best].median_revenue ? i : best, 0);

  res.json({ year, periods, best_index: bestIndex });
});

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

router.get('/historic', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const groupBy = ((req.query.groupBy as string) || 'week') as 'week' | 'month' | 'day';
  if (!['week', 'month', 'day'].includes(groupBy)) return res.status(400).json({ error: 'Invalid groupBy' });

  const db = await getDb();
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const currentYear = parseInt(todayLocal.slice(0, 4));
  const year = parseInt((req.query.year as string) || String(currentYear));

  let fromDate: string;
  let toDate: string;
  const truncUnit = groupBy;

  if (groupBy === 'week') {
    const monday = computeMonday(todayLocal);
    fromDate = addDays(monday, -11 * 7);
    toDate = todayLocal;
  } else {
    fromDate = `${year}-01-01`;
    toDate = groupBy === 'day' && year === currentYear ? todayLocal : `${year}-12-31`;
  }

  const { rows } = await db.query<{ period_start: string; revenue: string; cost: string; order_count: number }>(`
    SELECT
      DATE_TRUNC('${truncUnit}', paid_at AT TIME ZONE $3)::date::text AS period_start,
      SUM(revenue)::numeric AS revenue,
      SUM(cost)::numeric AS cost,
      COUNT(*)::int AS order_count
    FROM (
      SELECT o.paid_at, o.total AS revenue,
        COALESCE((SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id), 0) AS cost
      FROM orders o
      WHERE o.status = 'paid'
        AND (o.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
      UNION ALL
      SELECT t.paid_at, t.total AS revenue,
        COALESCE((SELECT SUM(quantity * unit_cost) FROM tab_items WHERE tab_id = t.id), 0) AS cost
      FROM tabs t
      WHERE t.status = 'paid'
        AND (t.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
    ) combined
    GROUP BY DATE_TRUNC('${truncUnit}', paid_at AT TIME ZONE $3)::date
    ORDER BY period_start
  `, [fromDate, toDate, tz]);

  const dataMap = new Map(rows.map(r => [
    String(r.period_start).slice(0, 10),
    { revenue: Number(r.revenue), cost: Number(r.cost), order_count: r.order_count },
  ]));

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const periods: { label: string; period_start: string; period_end: string; revenue: number; cost: number; profit: number; order_count: number }[] = [];

  if (groupBy === 'week') {
    for (let i = 0; i < 12; i++) {
      const start = addDays(fromDate, i * 7);
      const end = addDays(start, 6);
      const d = new Date(`${start}T12:00:00`);
      const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
      const data = dataMap.get(start) ?? { revenue: 0, cost: 0, order_count: 0 };
      periods.push({ label, period_start: start, period_end: end, revenue: data.revenue, cost: data.cost, profit: data.revenue - data.cost, order_count: data.order_count });
    }
  } else if (groupBy === 'month') {
    for (let m = 0; m < 12; m++) {
      const start = `${year}-${String(m + 1).padStart(2, '0')}-01`;
      const data = dataMap.get(start) ?? { revenue: 0, cost: 0, order_count: 0 };
      periods.push({ label: MONTHS[m], period_start: start, period_end: '', revenue: data.revenue, cost: data.cost, profit: data.revenue - data.cost, order_count: data.order_count });
    }
  } else {
    const cur = new Date(`${fromDate}T12:00:00`);
    const end = new Date(`${toDate}T12:00:00`);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const d = cur;
      const label = d.getDate() === 1 ? MONTHS[d.getMonth()] : String(d.getDate());
      const data = dataMap.get(dateStr) ?? { revenue: 0, cost: 0, order_count: 0 };
      periods.push({ label, period_start: dateStr, period_end: dateStr, revenue: data.revenue, cost: data.cost, profit: data.revenue - data.cost, order_count: data.order_count });
      cur.setDate(cur.getDate() + 1);
    }
  }

  const bestPeriodIndex = periods.reduce((best, p, i) => p.revenue > periods[best].revenue ? i : best, 0);

  let medianRevenue: number | null = null;
  let medianCost: number | null = null;
  let medianProfit: number | null = null;
  if (groupBy === 'day') {
    const withSales = periods.filter(p => p.revenue > 0);
    if (withSales.length > 0) {
      medianRevenue = medianOf(withSales.map(p => p.revenue));
      medianCost = medianOf(withSales.map(p => p.cost));
      medianProfit = medianOf(withSales.map(p => p.profit));
    }
  }

  res.json({ groupBy, periods, best_period_index: bestPeriodIndex, median_revenue: medianRevenue, median_cost: medianCost, median_profit: medianProfit });
});

export default router;
