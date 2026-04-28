import { Router } from 'express';
import { getDb } from '../db/database.js';
import { requireAdmin } from '../middleware/require-admin.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT * FROM providers ORDER BY name');
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const db = await getDb();
  const { rows } = await db.query(
    'INSERT INTO providers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
    [name.trim()]
  );
  res.status(201).json(rows[0]);
});

// GET /providers/session-bill?from=&to=&tz=
// Returns per-provider breakdown of untracked product sales in the date range.
router.get('/session-bill', async (req, res) => {
  const tz = (req.query.tz as string) || 'America/Monterrey';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const from = (req.query.from as string) || today;
  const to = (req.query.to as string) || today;
  const db = await getDb();

  const { rows } = await db.query<{
    provider_id: number; provider_name: string;
    product_id: number; product_name: string;
    unit_cost: number; qty_sold: string;
  }>(`
    SELECT
      pr.id   AS provider_id,
      pr.name AS provider_name,
      p.id    AS product_id,
      p.name  AS product_name,
      p.cost  AS unit_cost,
      COALESCE(SUM(sales.qty), 0) AS qty_sold
    FROM providers pr
    JOIN product_providers ppr ON ppr.provider_id = pr.id
    JOIN products p ON p.id = ppr.product_id AND p.track_inventory = false
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid'
        AND (o.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
      GROUP BY product_id
      UNION ALL
      SELECT product_id, SUM(quantity) AS qty
      FROM tab_items ti
      JOIN tabs t ON t.id = ti.tab_id
      WHERE t.status = 'paid'
        AND (t.paid_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
      GROUP BY product_id
    ) sales ON sales.product_id = p.id
    GROUP BY pr.id, pr.name, p.id, p.name, p.cost
    ORDER BY pr.name, p.name
  `, [from, to, tz]);

  // Group rows by provider
  const byProvider = new Map<number, {
    provider_id: number; provider_name: string;
    products: { product_id: number; product_name: string; qty_sold: number; unit_cost: number; subtotal: number }[];
    total: number;
  }>();
  for (const row of rows) {
    if (!byProvider.has(row.provider_id)) {
      byProvider.set(row.provider_id, { provider_id: row.provider_id, provider_name: row.provider_name, products: [], total: 0 });
    }
    const entry = byProvider.get(row.provider_id)!;
    const qty = Number(row.qty_sold);
    const subtotal = qty * Number(row.unit_cost);
    entry.products.push({ product_id: row.product_id, product_name: row.product_name, qty_sold: qty, unit_cost: Number(row.unit_cost), subtotal });
    entry.total += subtotal;
  }
  res.json(Array.from(byProvider.values()));
});

// POST /providers/:id/payment — ad-hoc expense ledger entry for a provider
router.post('/:id/payment', requireAdmin, async (req, res) => {
  const { amount, account, description } = req.body as { amount?: number; account?: string; description?: string };
  if (!amount || typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  if (!account?.trim()) return res.status(400).json({ error: 'account is required' });
  const db = await getDb();
  const { rows: [provider] } = await db.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  const desc = description?.trim() || `Provider payment: ${provider.name as string}`;
  const { rows: [entry] } = await db.query(
    `INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type)
     VALUES ('expense', $1, $2, $3, $4, 'provider') RETURNING *`,
    [account.trim(), -amount, desc, provider.id],
  );
  res.status(201).json(entry);
});

export default router;
