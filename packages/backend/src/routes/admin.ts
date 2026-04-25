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

export default router;
