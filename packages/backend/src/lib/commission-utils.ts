import type { Pool } from 'pg';

export async function applyCardCommission(
  db: Pool,
  paymentTotal: number,
  refId: number,
  refType: 'order' | 'tab',
  actor: string | null,
): Promise<void> {
  const { rows } = await db.query(
    "SELECT key, value FROM settings WHERE key IN ('card_commission_rate', 'card_commission_iva_rate')",
  );
  const rateMap = Object.fromEntries(
    (rows as { key: string; value: string }[]).map(r => [r.key, Number(r.value)]),
  );
  const rate = rateMap['card_commission_rate'] ?? 0.035;
  const ivaRate = rateMap['card_commission_iva_rate'] ?? 0.16;
  if (rate <= 0) return;
  const base = paymentTotal * rate;
  const total = +(base * (1 + ivaRate)).toFixed(2);
  const desc = `Card commission (${(rate * 100).toFixed(2)}% +IVA) on ${refType} #${refId}`;
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type, created_by) VALUES ('commission_transfer', 'digital', $1, $2, $3, $4, $5)",
    [-total, desc, refId, refType, actor],
  );
  await db.query(
    "INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type, created_by) VALUES ('commission', 'commissions', $1, $2, $3, $4, $5)",
    [-total, desc, refId, refType, actor],
  );
}
