import { Router } from 'express';
import { getDb } from '../db/database';

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

export default router;
