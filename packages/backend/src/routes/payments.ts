import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

router.post('/run', async (req, res) => {
  const { entries, note } = req.body as {
    entries: { payee_id: number; amount: number; source_account: string }[];
    note?: string;
  };
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }

  const db = await getDb();

  const payeeIds = entries.map(e => e.payee_id);
  const placeholders = payeeIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: payees } = await db.query(
    `SELECT * FROM payees WHERE id IN (${placeholders})`,
    payeeIds
  );
  const payeeMap = new Map(
    (payees as { id: number; name: string; type: string; source_account: string }[]).map(p => [p.id, p])
  );

  const createdEntries = [];
  for (const entry of entries) {
    const payee = payeeMap.get(entry.payee_id);
    if (!payee) return res.status(400).json({ error: `Payee ${entry.payee_id} not found` });

    const entryType =
      payee.type === 'staff' ? 'payroll' :
      payee.type === 'savings' ? 'savings_transfer' :
      'expense';
    const account = entry.source_account || payee.source_account;
    const description = note ? `${payee.name} — ${note}` : payee.name;

    const { rows } = await db.query(
      'INSERT INTO ledger_entries (entry_type, account, amount, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [entryType, account, -Math.abs(entry.amount), description]
    );
    createdEntries.push(rows[0]);
  }

  res.status(201).json({ entries: createdEntries });
});

export default router;
