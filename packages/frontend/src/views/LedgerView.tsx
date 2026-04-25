import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DailyTotal, LedgerEntry, LedgerEntryItem, Balance, Account, Payee } from '../api/client';
import { authClient } from '../lib/auth-client';

const EXPANDABLE = new Set(['sale', 'tab_payment']);
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
function fmtLocal(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: localTz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '');
}
function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: localTz });
}
function mondayLocal(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toLocaleDateString('en-CA', { timeZone: localTz });
}

function calcAmount(payee: Payee, active: Payee[], mode: 'equal' | 'weighted', total: number): number {
  if (mode === 'equal') return active.length > 0 ? total / active.length : 0;
  const sumW = active.reduce((s, p) => s + Number(p.default_weight), 0);
  return sumW > 0 ? total * (Number(payee.default_weight) / sumW) : 0;
}

export default function LedgerView() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<'entries' | 'balances' | 'payments'>('entries');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<number, LedgerEntryItem[] | null>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // ── Account adjustment ───────────────────────────────────────────────────────
  const [adjAccount, setAdjAccount] = useState('cash');
  const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDescription, setAdjDescription] = useState('');
  const [adjError, setAdjError] = useState('');
  const [adjSuccess, setAdjSuccess] = useState('');

  // ── Payments ─────────────────────────────────────────────────────────────────
  const [payees, setPayees] = useState<Payee[]>([]);
  const [paymentMode, setPaymentMode] = useState<'equal' | 'weighted' | 'manual'>('equal');
  const [paymentTotal, setPaymentTotal] = useState('');
  const [manualAmounts, setManualAmounts] = useState<Record<number, string>>({});
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentsError, setPaymentsError] = useState('');
  const [paymentsSuccess, setPaymentsSuccess] = useState('');
  const [showManagePayees, setShowManagePayees] = useState(false);
  const [newPayeeForm, setNewPayeeForm] = useState<{ name: string; type: Payee['type']; source_account: string; default_weight: string }>({
    name: '', type: 'staff', source_account: 'cash', default_weight: '1',
  });

  // ── Period summary ────────────────────────────────────────────────────────────
  const [beginsAt, setBeginsAt] = useState(mondayLocal);
  const [endsAt, setEndsAt] = useState(todayLocal);
  const [periodSummary, setPeriodSummary] = useState<DailyTotal | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    api.getLedger().then(setEntries).catch(() => {});
    api.getBalances().then(setBalances).catch(() => {});
    api.getAccounts().then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAdmin) loadPayees();
  }, [isAdmin]);

  async function loadPayees() {
    try { setPayees(await api.getPayees()); }
    catch (e: unknown) { setPaymentsError((e as Error).message); }
  }

  async function loadPeriodSummary() {
    if (!beginsAt || !endsAt) return;
    setSummaryLoading(true);
    try { setPeriodSummary(await api.getDailyTotal(beginsAt, endsAt, localTz)); }
    catch { setPeriodSummary(null); }
    setSummaryLoading(false);
  }

  function previewTotal(): number {
    const active = payees.filter(p => p.active);
    if (paymentMode === 'manual') return active.reduce((s, p) => s + (Number(manualAmounts[p.id]) || 0), 0);
    return Number(paymentTotal) || 0;
  }

  async function handleRunPayments() {
    setPaymentsError(''); setPaymentsSuccess('');
    const active = payees.filter(p => p.active);
    const totalNum = Number(paymentTotal) || 0;
    const entries = active.map(p => ({
      payee_id: p.id,
      amount: paymentMode === 'manual'
        ? Number(manualAmounts[p.id] || 0)
        : calcAmount(p, active, paymentMode as 'equal' | 'weighted', totalNum),
      source_account: p.source_account,
    })).filter(e => e.amount > 0);
    if (entries.length === 0) { setPaymentsError('No amounts to record'); return; }
    try {
      await api.runPayments(entries, paymentNote || undefined);
      setPaymentsSuccess('Payments recorded');
      setPaymentTotal(''); setManualAmounts({}); setPaymentNote('');
      const [e, b] = await Promise.all([api.getLedger(), api.getBalances()]);
      setEntries(e); setBalances(b);
    } catch (e: unknown) { setPaymentsError((e as Error).message); }
  }

  async function handleTogglePayee(id: number, active: boolean) {
    try { await api.updatePayee(id, { active }); loadPayees(); }
    catch (e: unknown) { setPaymentsError((e as Error).message); }
  }

  async function handleCreatePayee() {
    if (!newPayeeForm.name) return;
    try {
      await api.createPayee({ name: newPayeeForm.name, type: newPayeeForm.type, source_account: newPayeeForm.source_account, default_weight: Number(newPayeeForm.default_weight) || 1 });
      setNewPayeeForm({ name: '', type: 'staff', source_account: 'cash', default_weight: '1' });
      loadPayees();
    } catch (e: unknown) { setPaymentsError((e as Error).message); }
  }

  async function fetchEntryItems(entryId: number) {
    setLoadingId(entryId);
    try {
      const items = await api.getLedgerItems(entryId);
      setItemsCache(prev => ({ ...prev, [entryId]: items }));
    } catch {
      setItemsCache(prev => ({ ...prev, [entryId]: null }));
    }
    setLoadingId(null);
  }

  async function toggleEntry(entry: LedgerEntry) {
    if (!EXPANDABLE.has(entry.entry_type)) return;
    if (expandedId === entry.id) {
      if (itemsCache[entry.id] === null) { fetchEntryItems(entry.id); return; }
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    if (itemsCache[entry.id]) return;
    fetchEntryItems(entry.id);
  }

  async function handleAccountAdjustment() {
    setAdjError(''); setAdjSuccess('');
    const num = Number(adjAmount);
    if (!adjAmount || isNaN(num) || num <= 0) { setAdjError('Enter a positive amount'); return; }
    if (!adjDescription.trim()) { setAdjError('Description is required'); return; }
    const signed = adjType === 'add' ? num : -num;
    try {
      await api.adjustAccount(adjAccount, signed, adjDescription.trim());
      setAdjSuccess('Adjustment recorded');
      setAdjAmount(''); setAdjDescription('');
      const [e, b] = await Promise.all([api.getLedger(), api.getBalances()]);
      setEntries(e); setBalances(b);
    } catch (e: unknown) { setAdjError((e as Error).message); }
  }

  const TYPE_COLORS: Record<string, string> = {
    sale: '#16a34a', tab_payment: '#2563eb', register_open: '#7c3aed',
    register_close: '#dc2626', cashout: '#d97706', restock: '#0891b2',
    adjustment: '#db2777', payroll: '#ea580c', savings_transfer: '#0d9488', expense: '#9333ea',
    account_adjustment: '#6b7280',
  };

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      <div className="tabs-nav">
        <button className={`tabs-nav__item${tab === 'entries' ? ' active' : ''}`} onClick={() => setTab('entries')}>Entries</button>
        <button className={`tabs-nav__item${tab === 'balances' ? ' active' : ''}`} onClick={() => setTab('balances')}>Balances</button>
        {isAdmin && (
          <button className={`tabs-nav__item${tab === 'payments' ? ' active' : ''}`} onClick={() => setTab('payments')}>Payments</button>
        )}
      </div>

      {tab === 'entries' && (
        <div className="card" data-testid="ledger-entries">
          {entries.length === 0 ? <div className="empty">No entries yet</div> : entries.map(e => {
            const expandable = EXPANDABLE.has(e.entry_type);
            const expanded = expandedId === e.id;
            const items = itemsCache[e.id];
            return (
              <div key={e.id} data-testid="ledger-entry">
                <div
                  className={`list-item${expandable ? ' list-item--tappable' : ''}`}
                  style={expandable ? { cursor: 'pointer' } : undefined}
                  onClick={() => toggleEntry(e)}
                >
                  <div className="list-item__main">
                    <div className="list-item__name" style={{ color: TYPE_COLORS[e.entry_type] ?? 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {e.entry_type.replace('_', ' ')}
                      {expandable && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>
                      )}
                    </div>
                    <div className="list-item__sub">{e.description}</div>
                    {e.discount_name && e.discount_amount != null && (
                      <div className="list-item__sub" style={{ color: 'var(--warning, #d97706)' }}>
                        🏷 {e.discount_name} −${e.discount_amount.toFixed(2)}
                      </div>
                    )}
                    <div className="list-item__sub">{fmtLocal(e.created_at)}</div>
                    {isAdmin && e.created_by && (
                      <div className="list-item__sub" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        by {e.created_by}
                      </div>
                    )}
                  </div>
                  <div className="list-item__right">
                    <div style={{ fontWeight: 700, color: e.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {e.amount >= 0 ? '+' : ''}${e.amount.toFixed(2)}
                    </div>
                    {e.account && <div className="list-item__sub">{e.account}</div>}
                  </div>
                </div>
                {expanded && (
                  <div data-testid={`ledger-entry-items-${e.id}`} style={{ background: 'var(--surface-2, #f8fafc)', borderTop: '1px solid var(--border)', padding: '8px 16px 12px' }}>
                    {loadingId === e.id ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '4px 0' }}>Loading…</div>
                    ) : items === null ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>Could not load items — tap to retry</div>
                    ) : items && items.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                            <th style={{ fontWeight: 600, paddingBottom: 4 }}>Product</th>
                            <th style={{ fontWeight: 600, paddingBottom: 4, textAlign: 'center' }}>Qty</th>
                            <th style={{ fontWeight: 600, paddingBottom: 4, textAlign: 'right' }}>Unit</th>
                            <th style={{ fontWeight: 600, paddingBottom: 4, textAlign: 'right' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(item => (
                            <tr key={item.product_id} data-testid="ledger-item-row">
                              <td style={{ padding: '2px 0' }}>{item.name}</td>
                              <td style={{ padding: '2px 0', textAlign: 'center' }}>{item.quantity}</td>
                              <td style={{ padding: '2px 0', textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td>
                              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 600 }}>${item.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                          {e.discount_name && e.discount_amount != null && (
                            <tr>
                              <td colSpan={3} style={{ padding: '4px 0 2px', color: 'var(--warning, #d97706)', borderTop: '1px solid var(--border)' }}>
                                🏷 {e.discount_name}
                              </td>
                              <td style={{ padding: '4px 0 2px', textAlign: 'right', color: 'var(--warning, #d97706)', borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                                −${e.discount_amount.toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No items</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'balances' && (
        <div>
          <div className="stats" data-testid="balances">
            {balances.map(b => (
              <div className="stat" key={b.account} data-testid={`balance-${b.account}`}>
                <div className="stat__label">{b.account}</div>
                <div className="stat__value" style={{ color: b.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  ${b.balance.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div className="card" data-testid="accounts-list">
            <div className="card__title">Accounts</div>
            {accounts.map(a => (
              <div className="list-item" key={a.id}>
                <div className="list-item__name">{a.label}</div>
                <div className="badge badge--open">{a.name}</div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="card" data-testid="account-adjustment-form">
              <div className="card__title">Account Adjustment</div>
              {adjError && <div className="error-banner" style={{ marginBottom: 8 }}>{adjError}</div>}
              {adjSuccess && <div className="success-banner" data-testid="adjustment-success-banner" style={{ marginBottom: 8 }}>{adjSuccess}</div>}
              <div className="field">
                <label className="label">Account</label>
                <select
                  data-testid="adjustment-account-select"
                  className="input"
                  value={adjAccount}
                  onChange={e => setAdjAccount(e.target.value)}
                >
                  {accounts.map(a => (
                    <option key={a.name} value={a.name}>{a.label} ({a.name})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    data-testid="adjustment-type-add"
                    className={`btn btn--sm ${adjType === 'add' ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setAdjType('add')}
                  >
                    Add
                  </button>
                  <button
                    data-testid="adjustment-type-remove"
                    className={`btn btn--sm ${adjType === 'remove' ? 'btn--danger' : 'btn--ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setAdjType('remove')}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="label">Amount ($)</label>
                <input
                  data-testid="adjustment-amount-input"
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={adjAmount}
                  onChange={e => setAdjAmount(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">Description</label>
                <input
                  data-testid="adjustment-description-input"
                  className="input"
                  type="text"
                  placeholder="Reason for adjustment"
                  value={adjDescription}
                  onChange={e => setAdjDescription(e.target.value)}
                />
              </div>
              <button
                data-testid="adjustment-submit-btn"
                className={`btn ${adjType === 'remove' ? 'btn--danger' : 'btn--primary'}`}
                onClick={handleAccountAdjustment}
                disabled={!adjAmount || !adjDescription.trim()}
              >
                {adjType === 'add' ? 'Add to Account' : 'Remove from Account'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && isAdmin && (
        <>
          {paymentsError && <div className="error-banner">{paymentsError}</div>}
          {paymentsSuccess && <div className="success-banner" data-testid="payments-success-banner">{paymentsSuccess}</div>}

          {/* Account balances */}
          {balances.length > 0 && (
            <div className="stats" style={{ marginBottom: 4 }}>
              {balances.filter(b => b.account === 'cash' || b.account === 'credit_card').map(b => (
                <div className="stat" key={b.account} data-testid={`payments-balance-${b.account}`}>
                  <div className="stat__label">{b.account === 'credit_card' ? 'Card' : 'Cash'}</div>
                  <div className="stat__value" style={{ color: b.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ${b.balance.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Period summary */}
          <div className="card">
            <div className="card__title">Period Summary</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                <label className="label">From</label>
                <input className="input" type="date" value={beginsAt} onChange={e => setBeginsAt(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                <label className="label">To</label>
                <input className="input" type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
              </div>
              <button
                className="btn btn--ghost"
                style={{ flexShrink: 0, marginBottom: 0 }}
                onClick={loadPeriodSummary}
                disabled={summaryLoading || !beginsAt || !endsAt}
              >
                {summaryLoading ? '…' : 'Load'}
              </button>
            </div>
            {periodSummary && (
              <div className="stats" style={{ marginTop: 12 }}>
                <div className="stat">
                  <div className="stat__label">Revenue</div>
                  <div className="stat__value" style={{ color: 'var(--success)' }}>${Number(periodSummary.total_sales).toFixed(2)}</div>
                </div>
                <div className="stat">
                  <div className="stat__label">Cost</div>
                  <div className="stat__value" style={{ color: 'var(--danger)' }}>${Number(periodSummary.total_cost).toFixed(2)}</div>
                </div>
                <div className="stat">
                  <div className="stat__label">Gross Profit</div>
                  <div className="stat__value" style={{ color: (periodSummary.total_sales - periodSummary.total_cost) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ${(Number(periodSummary.total_sales) - Number(periodSummary.total_cost)).toFixed(2)}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat__label">Orders</div>
                  <div className="stat__value">{periodSummary.order_count}</div>
                </div>
              </div>
            )}
          </div>

          {/* Distribution */}
          <div className="card" data-testid="payments-section">
            <div className="card__title">Distribute Payments</div>

            <div className="field">
              <label className="label">Distribution mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['equal', 'weighted', 'manual'] as const).map(mode => (
                  <button
                    key={mode}
                    data-testid={`payment-mode-${mode}-btn`}
                    className={`btn btn--sm ${paymentMode === mode ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setPaymentMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {paymentMode !== 'manual' && (
              <div className="field">
                <label className="label">Total to distribute ($)</label>
                <input
                  data-testid="payment-total-input"
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentTotal}
                  onChange={e => setPaymentTotal(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label className="label">Note (optional)</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Week of Apr 14"
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
              />
            </div>

            {payees.filter(p => p.active).map(p => {
              const slug = p.name.toLowerCase().replace(/\s+/g, '-');
              const computed = paymentMode !== 'manual'
                ? calcAmount(p, payees.filter(q => q.active), paymentMode as 'equal' | 'weighted', Number(paymentTotal) || 0)
                : null;
              return (
                <div key={p.id} className="list-item" style={{ alignItems: 'center', gap: 10 }}>
                  <div className="list-item__main">
                    <div className="list-item__name">{p.name}</div>
                    <div className="list-item__sub">
                      <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>{p.type}</span>
                      {' '}{p.source_account}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, width: 110 }}>
                    {paymentMode === 'manual' ? (
                      <input
                        data-testid={`payee-amount-${slug}`}
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={manualAmounts[p.id] ?? ''}
                        onChange={e => setManualAmounts(a => ({ ...a, [p.id]: e.target.value }))}
                        style={{ textAlign: 'right' }}
                      />
                    ) : (
                      <div
                        data-testid={`payee-amount-${slug}`}
                        style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.95rem' }}
                      >
                        ${(computed ?? 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {payees.filter(p => p.active).length === 0 && (
              <div className="empty">No active payees — add one below</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <span data-testid="payment-preview-total" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                ${previewTotal().toFixed(2)}
              </span>
            </div>

            <button
              data-testid="record-payments-btn"
              className="btn btn--primary"
              style={{ marginTop: 12 }}
              onClick={handleRunPayments}
              disabled={payees.filter(p => p.active).length === 0}
            >
              Record Payments
            </button>
          </div>

          {/* Manage payees */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="card__title" style={{ marginBottom: 0 }}>Manage Payees</div>
              <button className="btn btn--sm btn--ghost" onClick={() => setShowManagePayees(v => !v)}>
                {showManagePayees ? 'Hide' : 'Show'}
              </button>
            </div>

            {showManagePayees && (
              <>
                {payees.map(p => {
                  const slug = p.name.toLowerCase().replace(/\s+/g, '-');
                  return (
                    <div key={p.id} className="list-item" style={{ opacity: p.active ? 1 : 0.55, alignItems: 'center', gap: 8 }}>
                      <div className="list-item__main">
                        <div className="list-item__name">{p.name}</div>
                        <div className="list-item__sub">
                          <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>{p.type}</span>
                          {!p.active && <span className="badge badge--void" style={{ fontSize: '0.65rem', marginLeft: 4 }}>INACTIVE</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>W</label>
                        <input
                          data-testid={`payee-weight-${slug}`}
                          className="input"
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={p.default_weight}
                          onChange={e => api.updatePayee(p.id, { default_weight: Number(e.target.value) }).then(loadPayees)}
                          style={{ width: 52, textAlign: 'center', padding: '6px 4px' }}
                        />
                      </div>
                      <button
                        data-testid={`payee-active-toggle-${slug}`}
                        className={`btn btn--sm ${p.active ? 'btn--ghost' : 'btn--primary'}`}
                        onClick={() => handleTogglePayee(p.id, !p.active)}
                      >
                        {p.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  );
                })}

                <div data-testid="add-payee-form" style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      placeholder="Name"
                      value={newPayeeForm.name}
                      onChange={e => setNewPayeeForm(f => ({ ...f, name: e.target.value }))}
                      style={{ flex: 2, minWidth: 120 }}
                    />
                    <select
                      className="input"
                      value={newPayeeForm.type}
                      onChange={e => setNewPayeeForm(f => ({ ...f, type: e.target.value as Payee['type'] }))}
                      style={{ width: 'auto' }}
                    >
                      <option value="staff">Staff</option>
                      <option value="expense">Expense</option>
                      <option value="savings">Savings</option>
                    </select>
                    <select
                      className="input"
                      value={newPayeeForm.source_account}
                      onChange={e => setNewPayeeForm(f => ({ ...f, source_account: e.target.value }))}
                      style={{ width: 'auto' }}
                    >
                      <option value="cash">Cash</option>
                      <option value="credit_card">Card</option>
                    </select>
                    <input
                      className="input"
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder="Weight"
                      value={newPayeeForm.default_weight}
                      onChange={e => setNewPayeeForm(f => ({ ...f, default_weight: e.target.value }))}
                      style={{ width: 70 }}
                    />
                    <button
                      className="btn btn--primary"
                      style={{ width: 'auto', padding: '10px 16px' }}
                      onClick={handleCreatePayee}
                      disabled={!newPayeeForm.name}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
