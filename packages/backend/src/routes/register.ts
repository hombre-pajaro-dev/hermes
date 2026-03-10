import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

function getOpenSession() {
  return getDb().prepare("SELECT * FROM register_sessions WHERE status = 'open' LIMIT 1").get() as Record<string, unknown> | undefined;
}

router.get('/session', (_req, res) => {
  const session = getOpenSession();
  res.json(session ?? null);
});

router.post('/open', (req, res) => {
  const db = getDb();
  const existing = getOpenSession();
  if (existing) {
    return res.status(409).json({ error: 'Register is already open' });
  }
  const { opening_cash } = req.body;
  if (opening_cash == null) {
    return res.status(400).json({ error: 'opening_cash is required' });
  }
  const result = db.prepare(
    "INSERT INTO register_sessions (opening_cash, status, opened_at) VALUES (?, 'open', datetime('now'))"
  ).run(opening_cash);
  const sessionId = result.lastInsertRowid as number;
  db.prepare(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('register_open', 'cash', ?, 'Register opened', ?, 'session')"
  ).run(opening_cash, sessionId);
  const session = db.prepare('SELECT * FROM register_sessions WHERE id = ?').get(sessionId);
  res.status(201).json(session);
});

router.post('/cashout', (req, res) => {
  const db = getDb();
  const session = getOpenSession();
  if (!session) return res.status(403).json({ error: 'Register is not open' });
  const { amount, reason = '' } = req.body;
  if (amount == null) return res.status(400).json({ error: 'amount is required' });
  const result = db.prepare(
    "INSERT INTO cashouts (session_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(session.id, amount, reason);
  const cashoutId = result.lastInsertRowid as number;
  db.prepare(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('cashout', 'cash', ?, ?, ?, 'cashout')"
  ).run(-amount, `Cashout: ${reason}`, cashoutId);
  const cashout = db.prepare('SELECT * FROM cashouts WHERE id = ?').get(cashoutId);
  res.status(201).json(cashout);
});

router.post('/close', (req, res) => {
  const db = getDb();
  const session = getOpenSession();
  if (!session) return res.status(403).json({ error: 'Register is not open' });
  const { closing_cash } = req.body;
  if (closing_cash == null) return res.status(400).json({ error: 'closing_cash is required' });
  const openTabs = db.prepare("SELECT COUNT(*) as count FROM tabs WHERE session_id = ? AND status = 'open'").get(session.id) as { count: number };
  if (openTabs.count > 0) {
    return res.status(409).json({ error: 'Cannot close register while there are open tabs (long-lasting orders)' });
  }
  db.prepare(
    "UPDATE register_sessions SET status = 'closed', closing_cash = ?, closed_at = datetime('now') WHERE id = ?"
  ).run(closing_cash, session.id);
  db.prepare(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('register_close', 'cash', ?, 'Register closed', ?, 'session')"
  ).run(-closing_cash, session.id);
  const updated = db.prepare('SELECT * FROM register_sessions WHERE id = ?').get(session.id);
  res.json(updated);
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

  // Merge by product_id
  const merged = new Map<number, typeof byItem[0]>();
  for (const row of byItem) {
    const existing = merged.get(row.product_id);
    if (existing) {
      existing.units_sold += row.units_sold;
      existing.revenue += row.revenue;
      existing.cost += row.cost;
      existing.profit += row.profit;
    } else {
      merged.set(row.product_id, { ...row });
    }
  }
  const items = Array.from(merged.values());
  const revenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalCost = items.reduce((s, i) => s + i.cost, 0);
  const mostSold = items.sort((a, b) => b.units_sold - a.units_sold)[0] ?? null;
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

export default router;
