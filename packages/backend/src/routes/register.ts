import { Router } from 'express';
import { getDb, pool } from '../db/database.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { productUsesSupplies } from '../lib/supply-utils.js';

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
           COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
           COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) as transfer_sales
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

  // Active products: sold, tabbed, or restocked during the session (unit-tracked, no supplies)
  const { rows: activeProductRows } = await db.query<{ id: number; name: string; price: number; physical_count: number | null; delta: number | null }>(`
    SELECT DISTINCT p.id, p.name, p.price,
      (SELECT ia.physical_count FROM inventory_adjustments ia WHERE ia.session_id = $1 AND ia.product_id = p.id ORDER BY ia.created_at DESC LIMIT 1) as physical_count,
      (SELECT ia.delta        FROM inventory_adjustments ia WHERE ia.session_id = $1 AND ia.product_id = p.id ORDER BY ia.created_at DESC LIMIT 1) as delta
    FROM products p
    WHERE p.track_inventory = true
      AND p.id NOT IN (SELECT product_id FROM product_supplies)
      AND p.id IN (
        SELECT DISTINCT oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.session_id = $1
        UNION
        SELECT DISTINCT ti.product_id FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id WHERE t.session_id = $1
        UNION
        SELECT DISTINCT ri.product_id FROM restock_items ri JOIN restock_orders ro ON ro.id = ri.restock_order_id WHERE ro.session_id = $1
      )
    ORDER BY p.name
  `, [sessionId]);

  // Build active_products with system_count from closing snapshot
  const snapshot = session.inventory_snapshot_close as { products: { id: number; units: number }[] } | null;
  const snapshotMap = new Map((snapshot?.products ?? []).map(p => [p.id, p.units]));
  const activeProducts = activeProductRows.map(p => {
    const systemCount = snapshotMap.get(p.id) ?? null;
    const delta = p.delta != null ? Number(p.delta) : null;
    const value = delta != null && p.price != null ? delta * Number(p.price) : null;
    return {
      product_id: p.id,
      name: p.name,
      price: Number(p.price),
      system_count: systemCount,
      physical_count: p.physical_count != null ? Number(p.physical_count) : null,
      delta,
      value,
    };
  });

  const { rows: [commRow] } = await db.query(`
    SELECT COALESCE(SUM(amount), 0) as commission_total
    FROM ledger_entries
    WHERE entry_type = 'commission' AND account = 'commissions'
      AND ref_type = 'order'
      AND ref_id IN (SELECT id FROM orders WHERE session_id = $1 AND status = 'paid')
  `, [sessionId]);
  const commissionTotal = Math.abs(Number(commRow.commission_total));

  // Unlinked payments: payroll/expense/savings with no session, created within this session's time window
  const { rows: unlinkedPayments } = await db.query<{ id: number; entry_type: string; account: string; amount: number; description: string; created_at: string }>(
    `SELECT id, entry_type, account, amount, description, created_at
     FROM ledger_entries
     WHERE session_id IS NULL
       AND entry_type IN ('payroll', 'expense', 'savings_transfer')
       AND amount < 0
       AND created_at >= $1
       AND created_at <= COALESCE($2, NOW())
     ORDER BY created_at`,
    [session.opened_at, session.closed_at ?? null]
  );

  const { rows: payments } = await db.query<{ id: number; entry_type: string; account: string; amount: number; description: string; created_at: string }>(
    `SELECT id, entry_type, account, amount, description, created_at
     FROM ledger_entries
     WHERE session_id = $1 AND entry_type IN ('payroll', 'expense', 'savings_transfer') AND amount < 0
     ORDER BY created_at`,
    [sessionId]
  );

  // Cash reconciliation — tabs scoped by session_id (tabs are session-exclusive).
  const { rows: [cashReconRow] } = await db.query(`
    SELECT
      $2::numeric
      + COALESCE((SELECT SUM(total) FROM orders WHERE session_id = $1 AND status = 'paid' AND payment_method = 'cash'), 0)
      + COALESCE((SELECT SUM(total) FROM tabs   WHERE session_id = $1 AND status = 'paid' AND payment_method = 'cash'), 0)
      - COALESCE((SELECT SUM(amount) FROM cashouts WHERE session_id = $1), 0)
      + COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE session_id = $1 AND entry_type IN ('payroll', 'expense', 'savings_transfer') AND account = 'cash' AND amount < 0), 0)
    AS expected_cash
  `, [sessionId, session.opening_cash]);
  const expectedCash = Number(cashReconRow.expected_cash);
  const closingCash = session.closing_cash != null ? Number(session.closing_cash) : null;
  const cashVariance = closingCash != null ? closingCash - expectedCash : null;

  // Digital reconciliation — card + transfer inflows minus commissions and digital payouts.
  const { rows: [digitalReconRow] } = await db.query(`
    SELECT
      COALESCE((SELECT SUM(total) FROM orders WHERE session_id = $1 AND status = 'paid' AND payment_method IN ('card', 'transfer')), 0)
      + COALESCE((SELECT SUM(total) FROM tabs   WHERE session_id = $1 AND status = 'paid' AND payment_method IN ('card', 'transfer')), 0)
      + COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE entry_type = 'commission_transfer' AND account = 'digital' AND ref_type = 'order' AND ref_id IN (SELECT id FROM orders WHERE session_id = $1 AND status = 'paid')), 0)
      + COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE session_id = $1 AND entry_type IN ('payroll', 'expense', 'savings_transfer') AND account = 'digital' AND amount < 0), 0)
    AS expected_digital
  `, [sessionId]);
  const expectedDigital = Number(digitalReconRow.expected_digital);

  // P&L: full revenue including tabs, tab COGS, write-offs, inventory adjustment value
  const { rows: [tabTotalsRow] } = await db.query(`
    SELECT
      COALESCE(SUM(t.total), 0) as tab_revenue,
      COALESCE(SUM(CASE WHEN t.payment_method = 'cash'     THEN t.total ELSE 0 END), 0) as tab_cash,
      COALESCE(SUM(CASE WHEN t.payment_method = 'card'     THEN t.total ELSE 0 END), 0) as tab_card,
      COALESCE(SUM(CASE WHEN t.payment_method = 'transfer' THEN t.total ELSE 0 END), 0) as tab_transfer,
      COALESCE(SUM(ti_cost.cost), 0) as tab_cost
    FROM tabs t
    LEFT JOIN (
      SELECT tab_id, SUM(quantity * unit_cost) as cost FROM tab_items GROUP BY tab_id
    ) ti_cost ON ti_cost.tab_id = t.id
    WHERE t.session_id = $1 AND t.status = 'paid'
  `, [sessionId]);

  const { rows: [pnlRow] } = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'payroll'      AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) as payroll,
      COALESCE(SUM(CASE WHEN entry_type = 'expense'      AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses,
      COALESCE(SUM(CASE WHEN entry_type = 'tab_writeoff' AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) as writeoffs
    FROM ledger_entries WHERE session_id = $1
  `, [sessionId]);

  const { rows: [adjValueRow] } = await db.query(`
    SELECT COALESCE(SUM(le.amount), 0) as adj_value
    FROM ledger_entries le
    WHERE le.entry_type = 'adjustment' AND le.ref_type = 'adjustment'
      AND le.ref_id IN (SELECT id FROM inventory_adjustments WHERE session_id = $1)
  `, [sessionId]);

  const pnlRevenue    = Number(totals.revenue) + Number(tabTotalsRow.tab_revenue);
  const pnlCogs       = Number(costRow.total_cost) + Number(tabTotalsRow.tab_cost);
  const pnlGrossProfit = pnlRevenue - pnlCogs - commissionTotal;
  const pnlPayroll    = Number(pnlRow.payroll);
  const pnlExpenses   = Number(pnlRow.expenses);
  const pnlWriteoffs  = Number(pnlRow.writeoffs);
  const pnlInvAdj     = Number(adjValueRow.adj_value);
  const pnlNet        = pnlGrossProfit - pnlPayroll - pnlExpenses - pnlWriteoffs + pnlInvAdj;

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
    commission_total: commissionTotal,
    gross_profit: Number(totals.revenue) - Number(costRow.total_cost) - commissionTotal,
    cash_sales: Number(totals.cash_sales),
    card_sales: Number(totals.card_sales),
    transfer_sales: Number(totals.transfer_sales),
    expected_cash: expectedCash,
    expected_digital: expectedDigital,
    actual_digital: session.actual_digital != null ? Number(session.actual_digital) : null,
    digital_variance: session.actual_digital != null ? Number(session.actual_digital) - expectedDigital : null,
    cash_variance: cashVariance,
    by_item: byItem.map(r => ({
      product_id: r.product_id, name: r.name,
      units_sold: Number(r.units_sold), revenue: Number(r.revenue),
      cost: Number(r.cost), profit: Number(r.profit),
    })),
    cashouts: cashouts.map(c => ({ id: c.id, amount: Number(c.amount), reason: c.reason, created_at: c.created_at })),
    restocked: restocked.map(r => ({ product_id: r.product_id, name: r.name, units_restocked: Number(r.units_restocked) })),
    adjustments: adjustments.map(a => ({ product_id: a.product_id, name: a.name, delta: Number(a.delta) })),
    payments: payments.map(p => ({ id: p.id, entry_type: p.entry_type, account: p.account, amount: Number(p.amount), description: p.description, created_at: p.created_at })),
    active_products: activeProducts,
    unlinked_payments: unlinkedPayments.map(p => ({ id: p.id, entry_type: p.entry_type, account: p.account, amount: Number(p.amount), description: p.description, created_at: p.created_at })),
    pnl: {
      revenue: pnlRevenue,
      tab_revenue: Number(tabTotalsRow.tab_revenue),
      tab_cash: Number(tabTotalsRow.tab_cash),
      tab_card: Number(tabTotalsRow.tab_card),
      tab_transfer: Number(tabTotalsRow.tab_transfer),
      cogs: pnlCogs,
      commissions: commissionTotal,
      gross_profit: pnlGrossProfit,
      payroll: pnlPayroll,
      expenses: pnlExpenses,
      writeoffs: pnlWriteoffs,
      inventory_adjustment: pnlInvAdj,
      net: pnlNet,
    },
  });
});

router.patch('/sessions/:id/reconcile', requireAdmin, async (req, res) => {
  const db = await getDb();
  const sessionId = Number(req.params.id);
  const { rows: [session] } = await db.query('SELECT * FROM register_sessions WHERE id = $1', [sessionId]);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'closed') return res.status(409).json({ error: 'Can only reconcile a closed session' });

  const { physical_counts, actual_digital } = req.body as {
    physical_counts?: { product_id: number; units: number }[];
    actual_digital?: number;
  };

  const snapshot = session.inventory_snapshot_close as { products: { id: number; units: number }[] } | null;
  const snapshotMap = new Map((snapshot?.products ?? []).map(p => [p.id, p.units]));

  if (Array.isArray(physical_counts)) {
    for (const count of physical_counts) {
      const { rows: [product] } = await db.query('SELECT * FROM products WHERE id = $1', [count.product_id]);
      if (!product || product.track_inventory === false) continue;
      const usesSupplies = await productUsesSupplies(db, count.product_id);
      if (usesSupplies) continue;

      // Remove existing adjustment for this (session, product) and revert its unit change
      const { rows: existing } = await db.query(
        'SELECT * FROM inventory_adjustments WHERE session_id = $1 AND product_id = $2 ORDER BY created_at DESC LIMIT 1',
        [sessionId, count.product_id]
      );
      if (existing[0]) {
        await db.query('DELETE FROM ledger_entries WHERE ref_id = $1 AND ref_type = $2', [existing[0].id, 'adjustment']);
        await db.query('UPDATE products SET units = units - $1 WHERE id = $2', [existing[0].delta, count.product_id]);
        await db.query('DELETE FROM inventory_adjustments WHERE id = $1', [existing[0].id]);
      }

      const systemCount = snapshotMap.get(count.product_id) ?? product.units;
      const delta = count.units - systemCount;
      if (delta === 0) continue;

      await db.query('UPDATE products SET units = $1 WHERE id = $2', [count.units, count.product_id]);
      const { rows: [adjRow] } = await db.query(
        'INSERT INTO inventory_adjustments (session_id, product_id, previous_units, physical_count, delta, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
        [sessionId, count.product_id, systemCount, count.units, delta]
      );
      await db.query(
        "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('adjustment', 'inventory_adjustment', $1, $2, $3, 'adjustment')",
        [delta * product.cost, `Reconciliation: ${product.name} (${delta > 0 ? '+' : ''}${delta} units)`, adjRow.id]
      );
    }
  }

  if (actual_digital != null) {
    await db.query('UPDATE register_sessions SET actual_digital = $1 WHERE id = $2', [actual_digital, sessionId]);
  }

  res.json({ ok: true });
});

router.post('/sessions/:id/claim-payments', requireAdmin, async (req, res) => {
  const db = await getDb();
  const sessionId = Number(req.params.id);
  const { rows: [session] } = await db.query('SELECT * FROM register_sessions WHERE id = $1', [sessionId]);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { entry_ids } = req.body as { entry_ids: number[] };
  if (!Array.isArray(entry_ids) || entry_ids.length === 0) {
    return res.status(400).json({ error: 'entry_ids array is required' });
  }

  const placeholders = entry_ids.map((_, i) => `$${i + 2}`).join(', ');
  const { rowCount } = await db.query(
    `UPDATE ledger_entries
     SET session_id = $1
     WHERE id IN (${placeholders})
       AND session_id IS NULL
       AND entry_type IN ('payroll', 'expense', 'savings_transfer')`,
    [sessionId, ...entry_ids]
  );

  res.json({ claimed: rowCount ?? 0 });
});

router.post('/open', async (req, res) => {
  const existing = await getOpenSession();
  if (existing) return res.status(409).json({ error: 'Register is already open' });
  const { opening_cash } = req.body;
  if (opening_cash == null) return res.status(400).json({ error: 'opening_cash is required' });
  const db = await getDb();

  // Variance = counted - current cash balance
  const { rows: [balanceRow] } = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS cash_balance FROM ledger_entries WHERE account = 'cash'"
  );
  const currentBalance = Number(balanceRow.cash_balance);
  const variance = Number(opening_cash) - currentBalance;

  const snapshot = await captureInventorySnapshot(db);
  const { rows } = await db.query(
    "INSERT INTO register_sessions (opening_cash, status, opened_at, inventory_snapshot_open) VALUES ($1, 'open', NOW(), $2) RETURNING *",
    [opening_cash, JSON.stringify(snapshot)]
  );
  const session = rows[0];

  const openDesc = variance === 0
    ? 'Register opened — balanced'
    : variance > 0
      ? `Register opened — cash over $${variance.toFixed(2)}`
      : `Register opened — cash short $${Math.abs(variance).toFixed(2)}`;

  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('register_open', 'cash', $1, $2, $3, 'session')",
    [variance, openDesc, session.id]
  );
  res.status(201).json(session);
});

router.post('/cashout', requireAdmin, async (req, res) => {
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

router.post('/close', requireAdmin, async (req, res) => {
  const session = await getOpenSession();
  if (!session) return res.status(403).json({ error: 'Register is not open' });
  const { closing_cash } = req.body as { closing_cash: number };
  if (closing_cash == null) return res.status(400).json({ error: 'closing_cash is required' });

  const db = await getDb();
  const { rows: openTabs } = await db.query<{ id: number; name: string; total: number }>(
    "SELECT id, name, total FROM tabs WHERE session_id = $1 AND status = 'open'",
    [session.id]
  );
  if (openTabs.length > 0) {
    return res.status(409).json({
      error: `Cannot close session — ${openTabs.length} open tab(s) must be paid first`,
      open_tabs: openTabs.map(t => ({ id: t.id, name: t.name, total: Number(t.total) })),
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Compute expected cash: opening + cash sales (orders + tabs by session) - cashouts - cash payouts
    const { rows: [expectedRow] } = await client.query(`
      SELECT
        $2::numeric
        + COALESCE((SELECT SUM(total) FROM orders WHERE session_id = $1 AND status = 'paid' AND payment_method = 'cash'), 0)
        + COALESCE((SELECT SUM(total) FROM tabs   WHERE session_id = $1 AND status = 'paid' AND payment_method = 'cash'), 0)
        - COALESCE((SELECT SUM(amount) FROM cashouts WHERE session_id = $1), 0)
        + COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE session_id = $1 AND entry_type IN ('payroll', 'expense', 'savings_transfer') AND account = 'cash' AND amount < 0), 0)
      AS expected_cash
    `, [session.id, session.opening_cash]);
    const expectedCash = Number(expectedRow.expected_cash);
    const variance = Number(closing_cash) - expectedCash;

    const snapshot = await captureInventorySnapshot(client as unknown as Awaited<ReturnType<typeof getDb>>);
    await client.query(
      "UPDATE register_sessions SET status = 'closed', closing_cash = $1, closed_at = NOW(), inventory_snapshot_close = $2 WHERE id = $3",
      [closing_cash, JSON.stringify(snapshot), session.id]
    );

    const varianceDesc = variance === 0
      ? 'Register closed — balanced'
      : variance > 0
        ? `Register closed — cash over $${variance.toFixed(2)}`
        : `Register closed — cash short $${Math.abs(variance).toFixed(2)}`;

    await client.query(
      "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type) VALUES ('register_close', 'cash', $1, $2, $3, 'session')",
      [variance, varianceDesc, session.id]
    );


    await client.query('COMMIT');
    const { rows } = await client.query('SELECT * FROM register_sessions WHERE id = $1', [session.id]);
    res.json(rows[0]);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
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
