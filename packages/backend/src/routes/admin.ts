import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.js';

interface AuthRequest extends Request {
  session?: { user: { role?: string } };
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.session?.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

const router = Router();

async function getPin(): Promise<string> {
  const db = await getDb();
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', ['pin']);
  return rows[0]?.value ?? '1234';
}

router.post('/pin/verify', async (req, res) => {
  const { pin } = req.body as { pin?: string };
  if (!pin) { res.status(400).json({ error: 'PIN is required' }); return; }
  if (pin !== await getPin()) { res.status(401).json({ error: 'Invalid PIN' }); return; }
  res.json({ ok: true });
});

router.post('/pin/change', async (req, res) => {
  const { current_pin, new_pin } = req.body as { current_pin?: string; new_pin?: string };
  if (!current_pin || !new_pin) { res.status(400).json({ error: 'current_pin and new_pin are required' }); return; }
  if (current_pin !== await getPin()) { res.status(401).json({ error: 'Invalid current PIN' }); return; }
  if (new_pin.length < 4) { res.status(400).json({ error: 'PIN must be at least 4 characters' }); return; }
  const db = await getDb();
  await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['pin', new_pin]);
  res.json({ ok: true });
});

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

export default router;
