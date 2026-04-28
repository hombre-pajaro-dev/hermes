import { Router } from 'express';
import { getDb } from '../db/database.js';
import { requireAdmin } from '../middleware/require-admin.js';

const router = Router();

// ── Authorized users management ─────────────────────────────────────────────

router.get('/users', requireAdmin, async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query('SELECT id, email, role, created_at FROM authorized_users ORDER BY created_at ASC');
  res.json(rows);
});

router.post('/users', requireAdmin, async (req, res) => {
  const { email, role = 'staff' } = req.body as { email?: string; role?: string };
  if (!email) return res.status(400).json({ error: 'email is required' });
  if (!['staff', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be staff or admin' });
  const db = await getDb();
  try {
    const { rows } = await db.query(
      'INSERT INTO authorized_users (email, role) VALUES (LOWER($1), $2) RETURNING *',
      [email, role]
    );
    res.status(201).json(rows[0]);
  } catch (e: unknown) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('unique')) return res.status(409).json({ error: 'Email already authorized' });
    throw e;
  }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  const { role } = req.body as { role?: string };
  if (!role || !['staff', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be staff or admin' });
  const db = await getDb();
  const { rows } = await db.query(
    'UPDATE authorized_users SET role = $1 WHERE id = $2 RETURNING *',
    [role, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  // Also update the role in the Better Auth user table if the user has already signed in
  await db.query('UPDATE "user" SET role = $1 WHERE LOWER(email) = LOWER($2)', [role, rows[0].email]);
  res.json(rows[0]);
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query('DELETE FROM authorized_users WHERE id = $1 RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ── Commission settings ──────────────────────────────────────────────────────

router.get('/commissions', requireAdmin, async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query(
    "SELECT key, value FROM settings WHERE key IN ('card_commission_rate', 'card_commission_iva_rate')",
  );
  const rateMap = Object.fromEntries((rows as { key: string; value: string }[]).map(r => [r.key, Number(r.value)]));
  const rate = rateMap['card_commission_rate'] ?? 0.035;
  const ivaRate = rateMap['card_commission_iva_rate'] ?? 0.16;

  const { rows: ledger } = await db.query(
    "SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE entry_type = 'commission' AND account = 'commissions'",
  );
  const totalPaid = Math.abs(Number(ledger[0].total));

  res.json({ rate, iva_rate: ivaRate, total_paid: totalPaid });
});

router.patch('/commissions', requireAdmin, async (req, res) => {
  const { rate, iva_rate } = req.body as { rate?: number; iva_rate?: number };
  if (rate !== undefined && (isNaN(Number(rate)) || Number(rate) < 0 || Number(rate) > 1)) {
    return res.status(400).json({ error: 'rate must be between 0 and 1' });
  }
  if (iva_rate !== undefined && (isNaN(Number(iva_rate)) || Number(iva_rate) < 0 || Number(iva_rate) > 1)) {
    return res.status(400).json({ error: 'iva_rate must be between 0 and 1' });
  }
  const db = await getDb();
  if (rate !== undefined) {
    await db.query("INSERT INTO settings (key, value) VALUES ('card_commission_rate', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(rate)]);
  }
  if (iva_rate !== undefined) {
    await db.query("INSERT INTO settings (key, value) VALUES ('card_commission_iva_rate', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(iva_rate)]);
  }
  const { rows } = await db.query(
    "SELECT key, value FROM settings WHERE key IN ('card_commission_rate', 'card_commission_iva_rate')",
  );
  const rateMap = Object.fromEntries((rows as { key: string; value: string }[]).map(r => [r.key, Number(r.value)]));
  const { rows: ledger } = await db.query(
    "SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE entry_type = 'commission' AND account = 'commissions'",
  );
  const totalPaid = Math.abs(Number(ledger[0].total));
  res.json({ rate: rateMap['card_commission_rate'] ?? 0.035, iva_rate: rateMap['card_commission_iva_rate'] ?? 0.16, total_paid: totalPaid });
});

export default router;
