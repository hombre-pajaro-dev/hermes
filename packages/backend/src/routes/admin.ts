import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

function getPin(): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('pin') as { value: string } | undefined;
  return row?.value ?? '1234';
}

router.post('/pin/verify', (req, res) => {
  const { pin } = req.body as { pin?: string };
  if (!pin) { res.status(400).json({ error: 'PIN is required' }); return; }
  if (pin !== getPin()) { res.status(401).json({ error: 'Invalid PIN' }); return; }
  res.json({ ok: true });
});

router.post('/pin/change', (req, res) => {
  const { current_pin, new_pin } = req.body as { current_pin?: string; new_pin?: string };
  if (!current_pin || !new_pin) { res.status(400).json({ error: 'current_pin and new_pin are required' }); return; }
  if (current_pin !== getPin()) { res.status(401).json({ error: 'Invalid current PIN' }); return; }
  if (new_pin.length < 4) { res.status(400).json({ error: 'PIN must be at least 4 characters' }); return; }
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('pin', new_pin);
  res.json({ ok: true });
});

export default router;
