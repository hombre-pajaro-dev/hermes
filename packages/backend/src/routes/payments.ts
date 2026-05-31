import { Router } from 'express';
import { getDb } from '../db/database.js';
import { actorEmail } from '../lib/actor.js';

const router = Router();

router.post('/run', async (req, res) => {
  const { entries, note, session_id } = req.body as {
    entries: { payee_id: number; amount: number; source_account: string }[];
    note?: string;
    session_id?: number;
  };
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }

  const db = await getDb();
  const actor = actorEmail(req);

  // Auto-link to the open session if no session_id provided
  let resolvedSessionId: number | null = session_id ?? null;
  if (resolvedSessionId == null) {
    const { rows: [openSession] } = await db.query(
      "SELECT id FROM register_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    );
    resolvedSessionId = openSession?.id ?? null;
  }

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
      'INSERT INTO ledger_entries (entry_type, account, amount, description, created_by, session_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [entryType, account, -Math.abs(entry.amount), description, actor, resolvedSessionId]
    );
    createdEntries.push(rows[0]);

    if (payee.type === 'savings') {
      const { rows: creditRows } = await db.query(
        'INSERT INTO ledger_entries (entry_type, account, amount, description, created_by, session_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [entryType, 'savings', Math.abs(entry.amount), description, actor, resolvedSessionId]
      );
      createdEntries.push(creditRows[0]);
    }
  }

  res.status(201).json({ entries: createdEntries });
});

export default router;
