import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SalesByItem, DailyTotal, DailyRange, CloseBrief, InventoryAdjustmentItem, HistoricReport, WeekdayReport, RegisterSessionSummary, SessionReport } from '../api/client';
import { authClient } from '../lib/auth-client';
import ColumnChart from '../components/ColumnChart';
import DateTimeRangeFilter from '../components/DateTimeRangeFilter';

function UnclaimedPaymentsCard({ sessionId, entries, onClaimed }: {
  sessionId: number;
  entries: { id: number; entry_type: string; amount: number; description: string; created_at: string }[];
  onClaimed: () => void;
}) {
  const [claiming, setClaiming] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function claim(entryId: number) {
    setClaiming(entryId); setError('');
    try {
      await api.claimPayments(sessionId, [entryId]);
      onClaimed();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setClaiming(null); }
  }

  const typeLabel = (t: string) => t === 'payroll' ? 'Staff' : t === 'savings_transfer' ? 'Savings' : 'Expense';

  return (
    <div className="card" style={{ borderColor: 'var(--warning, #f59e0b)', borderWidth: 2 }} data-testid="unclaimed-payments">
      <div className="card__title" style={{ color: 'var(--warning, #f59e0b)' }}>Unclaimed Payments</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        These payments were recorded during this session but not linked to it. Add them to include them in the report.
      </p>
      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}
      {entries.map(p => (
        <div className="list-item" key={p.id}>
          <div className="list-item__main">
            <div className="list-item__name">{p.description}</div>
            <div className="list-item__sub" style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>{typeLabel(p.entry_type)}</span>
              <span>{new Date(p.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>−${Math.abs(p.amount).toFixed(2)}</span>
            <button className="btn btn--ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              onClick={() => claim(p.id)} disabled={claiming === p.id}>
              {claiming === p.id ? '…' : 'Add'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const DIAGNOSIS_LABELS: Record<string, string> = {
  balanced: 'Balanced — everything checks out.',
  unrecorded_cash_sale: 'Likely unrecorded cash sale — cash surplus matches missing inventory.',
  unrecorded_digital_sale: 'Likely unrecorded digital sale — digital surplus matches missing inventory.',
  cash_shortage: 'Cash shortage — less cash than expected, no inventory variance.',
  overcharge_or_double_payment: 'Cash surplus — possible overcharge or double payment, inventory OK.',
  shrinkage: 'Inventory short but money reconciles — possible spoilage or shrinkage.',
  items_taken_no_payment: 'Items missing and money short — possible theft or unpaid walkout.',
  mixed_signals: 'Mixed signals — review manually.',
};

function ReconciliationNarrative({ report }: { report: import('../api/client').SessionReport }) {
  const s = report.reconciliation_summary;
  if (!s) return null;
  const label = DIAGNOSIS_LABELS[s.diagnosis] ?? s.diagnosis;
  const statusColor = s.net_ok ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)';
  return (
    <div className="card" data-testid="reconciliation-narrative" style={{ borderColor: statusColor, borderWidth: 2 }}>
      <div className="card__title" style={{ color: statusColor }}>
        {s.net_ok ? 'Reconciliation OK' : 'Reconciliation Issue'}
      </div>
      <p style={{ fontSize: '0.9rem', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.85rem' }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Cash Variance</div>
          <div style={{ fontWeight: 700, color: (s.cash_variance ?? 0) < -0.005 ? 'var(--danger)' : (s.cash_variance ?? 0) > 0.005 ? 'var(--success)' : undefined }}>
            {s.cash_variance != null ? `${s.cash_variance >= 0 ? '+' : ''}$${s.cash_variance.toFixed(2)}` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Digital Variance</div>
          <div style={{ fontWeight: 700, color: (s.digital_variance ?? 0) < -0.005 ? 'var(--danger)' : (s.digital_variance ?? 0) > 0.005 ? 'var(--success)' : undefined }}>
            {s.digital_variance != null ? `${s.digital_variance >= 0 ? '+' : ''}$${s.digital_variance.toFixed(2)}` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Inventory Value</div>
          <div style={{ fontWeight: 700, color: s.inventory_shortage_value < -0.005 ? 'var(--danger)' : s.inventory_shortage_value > 0.005 ? 'var(--success)' : undefined }}>
            {s.inventory_shortage_value !== 0 ? `${s.inventory_shortage_value >= 0 ? '+' : ''}$${s.inventory_shortage_value.toFixed(2)}` : '$0.00'}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Net variance: <strong style={{ color: statusColor }}>{s.net_variance >= 0 ? '+' : ''}${s.net_variance.toFixed(2)}</strong>
      </div>
    </div>
  );
}

function ReconciliationCard({ sessionId, report, onSaved }: { sessionId: number; report: import('../api/client').SessionReport; onSaved: () => void }) {
  const [reconDigital, setReconDigital] = useState(
    report.actual_digital != null ? String(report.actual_digital) : ''
  );
  const [reconCounts, setReconCounts] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const p of report.active_products ?? []) {
      if (p.physical_count != null) init[p.product_id] = String(p.physical_count);
    }
    return init;
  });
  const [reconSaving, setReconSaving] = useState(false);
  const [reconError, setReconError] = useState('');
  const [reconSuccess, setReconSuccess] = useState('');
  const activeProds = report.active_products ?? [];

  async function saveReconciliation() {
    setReconSaving(true); setReconError(''); setReconSuccess('');
    try {
      const physical_counts = Object.entries(reconCounts)
        .filter(([, v]) => v !== '')
        .map(([id, v]) => ({ product_id: Number(id), units: Number(v) }));
      const actual_digital = reconDigital !== '' ? Number(reconDigital) : undefined;
      await api.reconcileSession(sessionId, { physical_counts, actual_digital });
      setReconSuccess('Reconciliation saved');
      onSaved();
    } catch (e: unknown) { setReconError((e as Error).message); }
    finally { setReconSaving(false); }
  }

  return (
    <div className="card" data-testid="session-reconciliation">
      <div className="card__title">Reconciliation</div>
      {reconError && <div className="error-banner" style={{ marginBottom: 8 }}>{reconError}</div>}
      {reconSuccess && <div className="success-banner" style={{ marginBottom: 8 }}>{reconSuccess}</div>}
      <div className="field">
        <label className="label">Actual Digital Balance ($)</label>
        <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
          value={reconDigital} onChange={e => setReconDigital(e.target.value)} />
      </div>
      {activeProds.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Physical Counts</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Product</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>System</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Counted</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Δ Units</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Δ Value</th>
                </tr>
              </thead>
              <tbody>
                {activeProds.map(p => {
                  const raw = reconCounts[p.product_id] ?? '';
                  const counted = raw !== '' ? Number(raw) : null;
                  const sysCount = p.system_count;
                  const liveDelta = counted != null && sysCount != null ? counted - sysCount : p.delta;
                  const liveValue = liveDelta != null ? liveDelta * p.price : null;
                  return (
                    <tr key={p.product_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>{p.name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{sysCount ?? '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        <input type="number" min="0" step="1"
                          style={{ width: 70, textAlign: 'right', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4 }}
                          placeholder={sysCount != null ? String(sysCount) : ''}
                          value={raw}
                          onChange={e => setReconCounts(prev => ({ ...prev, [p.product_id]: e.target.value }))}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: liveDelta == null ? 'var(--text-secondary)' : liveDelta < 0 ? 'var(--danger)' : liveDelta > 0 ? 'var(--success)' : undefined }}>
                        {liveDelta == null ? '—' : `${liveDelta > 0 ? '+' : ''}${liveDelta}`}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: liveValue == null ? 'var(--text-secondary)' : liveValue < 0 ? 'var(--danger)' : liveValue > 0 ? 'var(--success)' : undefined }}>
                        {liveValue == null ? '—' : `${liveValue > 0 ? '+' : ''}$${liveValue.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <button className="btn btn--primary" style={{ marginTop: 12 }}
        onClick={saveReconciliation} disabled={reconSaving}>
        {reconSaving ? 'Saving…' : 'Save Reconciliation'}
      </button>
    </div>
  );
}

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const todayDatetime = () => {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: localTz });
  return { from: `${d}T00:00`, to: `${d}T23:59` };
};

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: localTz });
}

function loadDate(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const { value, date } = JSON.parse(raw) as { value: string; date: string };
    if (date === todayStr()) return value;
  } catch { /* ignore */ }
  return fallback;
}

function saveDate(key: string, value: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, date: todayStr() }));
  } catch { /* ignore */ }
}

export default function ReportsView() {
  const { data: authSession } = authClient.useSession();
  const isAdmin = (authSession?.user as { role?: string } | undefined)?.role === 'admin';

  const [tab, setTab] = useState<'sales' | 'range' | 'brief' | 'historic' | 'weekday' | 'session'>('sales');
  const [salesFrom, setSalesFrom] = useState(() => loadDate('reports-sales-from', todayDatetime().from));
  const [salesTo, setSalesTo] = useState(() => loadDate('reports-sales-to', todayDatetime().to));
  const [salesByItem, setSalesByItem] = useState<SalesByItem[]>([]);
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [adjItems, setAdjItems] = useState<InventoryAdjustmentItem[]>([]);
  const [dailyRange, setDailyRange] = useState<DailyRange[]>([]);
  const [closeBrief, setCloseBrief] = useState<CloseBrief | null>(null);
  const [rangeFrom, setRangeFrom] = useState(() => loadDate('reports-range-from', todayDatetime().from));
  const [rangeTo, setRangeTo] = useState(() => loadDate('reports-range-to', todayDatetime().to));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historicGroupBy, setHistoricGroupBy] = useState<'week' | 'month' | 'day'>('week');
  const [historicReport, setHistoricReport] = useState<HistoricReport | null>(null);
  const [weekdayReport, setWeekdayReport] = useState<WeekdayReport | null>(null);
  const [sessions, setSessions] = useState<RegisterSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [reopenError, setReopenError] = useState('');

  async function fetchSales(from = salesFrom, to = salesTo) {
    setLoading(true); setError('');
    try {
      const [items, totals, adjs] = await Promise.all([
        api.getSalesByItem(from, to, localTz),
        api.getDailyTotal(from, to, localTz),
        api.getInventoryAdjustmentReport(from, to, localTz),
      ]);
      setSalesByItem(items);
      setDailyTotal(totals);
      setAdjItems(adjs);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchRange(from = rangeFrom, to = rangeTo) {
    setLoading(true); setError('');
    try { setDailyRange(await api.getDailyRange(from, to, localTz)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchBrief() {
    setLoading(true); setError('');
    try { setCloseBrief(await api.getCloseBriefReport()); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchHistoric() {
    setLoading(true); setError('');
    try { setHistoricReport(await api.getHistoricReport(historicGroupBy, localTz)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchWeekday() {
    setLoading(true); setError('');
    try { setWeekdayReport(await api.getWeekdayReport(localTz)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchSessions() {
    setLoading(true); setError('');
    try {
      const list = await api.getRegisterSessions();
      setSessions(list);
      if (list.length > 0 && selectedSessionId === null) {
        setSelectedSessionId(list[0].id);
      }
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchSessionReport(id: number) {
    setLoading(true); setError('');
    try { setSessionReport(await api.getSessionReport(id)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleReopen(id: number) {
    setReopenLoading(true); setReopenError('');
    try {
      await api.reopenSession(id);
      await fetchSessions();
      await fetchSessionReport(id);
    } catch (e: unknown) { setReopenError((e as Error).message); }
    finally { setReopenLoading(false); }
  }

  useEffect(() => { if (tab === 'sales') fetchSales(); }, [tab]);
  useEffect(() => { if (tab === 'range') fetchRange(); }, [tab]);
  useEffect(() => { if (tab === 'brief') fetchBrief(); }, [tab]);
  useEffect(() => { if (tab === 'historic') fetchHistoric(); }, [tab, historicGroupBy]);
  useEffect(() => { if (tab === 'weekday') fetchWeekday(); }, [tab]);
  useEffect(() => { if (tab === 'session') fetchSessions(); }, [tab]);
  useEffect(() => { if (selectedSessionId !== null) fetchSessionReport(selectedSessionId); }, [selectedSessionId, reportRefreshKey]);

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      <div className="tabs-nav">
        <button className={`tabs-nav__item${tab === 'sales' ? ' active' : ''}`} onClick={() => setTab('sales')}>By Item</button>
        <button className={`tabs-nav__item${tab === 'range' ? ' active' : ''}`} onClick={() => setTab('range')}>Range</button>
        <button className={`tabs-nav__item${tab === 'brief' ? ' active' : ''}`} onClick={() => setTab('brief')}>Brief</button>
        <button className={`tabs-nav__item${tab === 'historic' ? ' active' : ''}`} onClick={() => setTab('historic')}>Historic</button>
        <button className={`tabs-nav__item${tab === 'weekday' ? ' active' : ''}`} onClick={() => setTab('weekday')}>By Weekday</button>
        <button className={`tabs-nav__item${tab === 'session' ? ' active' : ''}`} onClick={() => setTab('session')}>Sessions</button>
      </div>

      {tab === 'sales' && (
        <div>
          <DateTimeRangeFilter
            initialFrom={salesFrom}
            initialTo={salesTo}
            loading={loading}
            onApply={(from, to) => { setSalesFrom(from); setSalesTo(to); saveDate('reports-sales-from', from); saveDate('reports-sales-to', to); fetchSales(from, to); }}
          />
          {loading ? <div className="spinner">⏳</div> : (
            <>
              {dailyTotal && (
                <div className="stats" data-testid="daily-total">
                  <div className="stat"><div className="stat__label">Orders</div><div className="stat__value" data-testid="order-count">{dailyTotal.order_count}</div></div>
                  <div className="stat"><div className="stat__label">Sales</div><div className="stat__value" data-testid="total-sales">${dailyTotal.total_sales.toFixed(2)}</div></div>
                  <div className="stat"><div className="stat__label">Cash</div><div className="stat__value" data-testid="cash-sales">${Number(dailyTotal.cash_sales ?? 0).toFixed(2)}</div></div>
                  <div className="stat"><div className="stat__label">Card</div><div className="stat__value" data-testid="card-sales">${Number(dailyTotal.card_sales ?? 0).toFixed(2)}</div></div>
                  <div className="stat"><div className="stat__label">Cost</div><div className="stat__value">${dailyTotal.total_cost.toFixed(2)}</div></div>
                  <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${(dailyTotal.total_sales - dailyTotal.total_cost - (dailyTotal.commission_total ?? 0)).toFixed(2)}</div></div>
                  {dailyTotal.inventory_adjustment_total != null && dailyTotal.inventory_adjustment_total !== 0 && (
                    <div className="stat">
                      <div className="stat__label">Inv. Adjustment</div>
                      <div className="stat__value" style={{ color: dailyTotal.inventory_adjustment_total >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {dailyTotal.inventory_adjustment_total >= 0 ? '+' : ''}${dailyTotal.inventory_adjustment_total.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {(dailyTotal.commission_total ?? 0) > 0 && (
                    <div className="stat">
                      <div className="stat__label">Commissions</div>
                      <div className="stat__value" style={{ color: '#f59e0b' }}>
                        −${(dailyTotal.commission_total ?? 0).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {adjItems.length > 0 && (
                <div className="card" data-testid="inventory-adjustment-report" style={{ marginBottom: 12 }}>
                  <div className="card__title">Inventory Adjustments</div>
                  {adjItems.map(a => (
                    <div className="list-item" key={a.product_id} data-testid="adj-item-row">
                      <div className="list-item__main">
                        <div className="list-item__name" data-testid="adj-item-name">{a.name}</div>
                        <div className="list-item__sub">{a.adjustment_count} adjustment{a.adjustment_count !== 1 ? 's' : ''} · net {a.total_delta > 0 ? '+' : ''}{a.total_delta} units</div>
                      </div>
                      <div className="list-item__right" style={{ color: a.total_cost_impact >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }} data-testid="adj-item-cost">
                        {a.total_cost_impact >= 0 ? '+' : ''}${a.total_cost_impact.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="list-item" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
                    <div className="list-item__name" style={{ fontWeight: 600 }}>Total impact</div>
                    <div className="list-item__right" style={{ fontWeight: 700, color: adjItems.reduce((s, a) => s + a.total_cost_impact, 0) >= 0 ? 'var(--success)' : 'var(--danger)' }} data-testid="adj-total-cost">
                      {adjItems.reduce((s, a) => s + a.total_cost_impact, 0) >= 0 ? '+' : ''}${adjItems.reduce((s, a) => s + a.total_cost_impact, 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
              <div className="card" data-testid="sales-by-item">
                {salesByItem.length === 0 ? <div className="empty">No sales for this period</div> :
                  salesByItem.map(s => (
                    <div className="list-item" key={s.product_id} data-testid="sales-item">
                      <div className="list-item__main">
                        <div className="list-item__name" data-testid="sales-item-name">{s.name}</div>
                        <div className="list-item__sub" data-testid="sales-item-units">{s.units_sold} units sold</div>
                      </div>
                      <div className="list-item__right">
                        <div style={{ fontWeight: 700 }} data-testid="sales-item-revenue">${s.revenue.toFixed(2)}</div>
                        <div className="list-item__sub">cost ${s.cost.toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'range' && (
        <div>
          <DateTimeRangeFilter
            initialFrom={rangeFrom}
            initialTo={rangeTo}
            loading={loading}
            onApply={(from, to) => { setRangeFrom(from); setRangeTo(to); saveDate('reports-range-from', from); saveDate('reports-range-to', to); fetchRange(from, to); }}
          />
          <div className="card" data-testid="daily-range">
            {dailyRange.map(d => (
              <div className="list-item" key={d.date} data-testid="range-day">
                <div className="list-item__main">
                  <div className="list-item__name" data-testid="range-date">{d.date}</div>
                  <div className="list-item__sub">{d.order_count} orders</div>
                  {d.adjustment != null && d.adjustment !== 0 && (
                    <div className="list-item__sub" style={{ color: d.adjustment >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      adj {d.adjustment >= 0 ? '+' : ''}${d.adjustment.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="list-item__right">
                  <div style={{ fontWeight: 700 }}>${d.revenue.toFixed(2)}</div>
                  <div className="list-item__sub">cost ${d.cost.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'brief' && (
        <div>
          <button className="btn btn--ghost btn--sm" style={{ marginBottom: 12 }} onClick={fetchBrief}>Refresh</button>
          {closeBrief && (
            <div data-testid="close-brief">
              <div className="stats">
                <div className="stat"><div className="stat__label">Revenue</div><div className="stat__value" data-testid="brief-revenue">${closeBrief.revenue.toFixed(2)}</div></div>
                <div className="stat"><div className="stat__label">Cost</div><div className="stat__value" data-testid="brief-cost">${closeBrief.total_cost.toFixed(2)}</div></div>
                {(closeBrief.commission_total ?? 0) > 0 && (
                  <div className="stat"><div className="stat__label">Commissions</div><div className="stat__value" style={{ color: '#f59e0b' }}>−${(closeBrief.commission_total ?? 0).toFixed(2)}</div></div>
                )}
                <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${closeBrief.gross_profit.toFixed(2)}</div></div>
              </div>
              {closeBrief.expected_cash != null && (
                <div className="card" data-testid="cash-reconciliation">
                  <div className="card__title">Cash Reconciliation</div>
                  <div className="stats" style={{ marginTop: 8 }}>
                    <div className="stat">
                      <div className="stat__label">Expected</div>
                      <div className="stat__value">${closeBrief.expected_cash.toFixed(2)}</div>
                    </div>
                    {closeBrief.cash_variance != null && (
                      <div className="stat">
                        <div className="stat__label">{closeBrief.cash_variance === 0 ? 'Balanced' : closeBrief.cash_variance > 0 ? 'Over' : 'Short'}</div>
                        <div className="stat__value" style={{ color: closeBrief.cash_variance === 0 ? 'var(--success)' : closeBrief.cash_variance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {closeBrief.cash_variance === 0 ? '—' : `${closeBrief.cash_variance > 0 ? '+' : ''}$${closeBrief.cash_variance.toFixed(2)}`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {closeBrief.most_sold && <div className="card"><div className="card__title">Most Sold</div><div data-testid="most-sold">{closeBrief.most_sold.name} ({closeBrief.most_sold.units_sold} units)</div></div>}
              {closeBrief.most_profitable && <div className="card"><div className="card__title">Most Profitable</div><div data-testid="most-profitable">{closeBrief.most_profitable.name} (${closeBrief.most_profitable.profit.toFixed(2)})</div></div>}
              <div className="card"><div className="card__title">By Item</div>
                {(closeBrief.by_item ?? []).map(i => (
                  <div className="list-item" key={i.product_id}><div className="list-item__name">{i.name}</div><div className="list-item__right">${i.revenue.toFixed(2)}</div></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === 'historic' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['week', 'month', 'day'] as const).map(g => (
              <button
                key={g}
                className={`btn btn--sm ${historicGroupBy === g ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setHistoricGroupBy(g)}
                data-testid={`historic-group-${g}`}
              >
                {g === 'week' ? 'Weekly' : g === 'month' ? 'Monthly' : 'Daily'}
              </button>
            ))}
          </div>

          {loading && <div className="spinner">⏳</div>}

          {!loading && historicReport && (() => {
            const { periods, best_period_index, median_revenue, median_cost, median_profit } = historicReport;
            const best = periods[best_period_index];
            const hasData = periods.some(p => p.revenue > 0);

            return (
              <>
                {hasData ? (
                  <div className="card" style={{ padding: '12px 8px 8px' }} data-testid="historic-chart">
                    <ColumnChart
                      periods={periods}
                      groupBy={historicGroupBy}
                      bestIndex={best_period_index}
                      medianRevenue={median_revenue}
                    />
                  </div>
                ) : (
                  <div className="card"><div className="empty">No sales data for this period</div></div>
                )}

                {hasData && best && (
                  <div className="card" style={{ marginTop: 10 }} data-testid="historic-best">
                    <div className="card__title">
                      ★ Best {historicGroupBy === 'week' ? 'Week' : historicGroupBy === 'month' ? 'Month' : 'Day'} — {best.label}
                    </div>
                    <div className="stats" style={{ marginTop: 8 }}>
                      <div className="stat"><div className="stat__label">Revenue</div><div className="stat__value" data-testid="historic-best-revenue">${best.revenue.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Cost</div><div className="stat__value">${best.cost.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${best.profit.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Orders</div><div className="stat__value">{best.order_count}</div></div>
                    </div>
                  </div>
                )}

                {historicGroupBy === 'day' && median_revenue != null && (
                  <div className="card" style={{ marginTop: 10 }} data-testid="historic-medians">
                    <div className="card__title">Median (days with sales)</div>
                    <div className="stats" style={{ marginTop: 8 }}>
                      <div className="stat"><div className="stat__label">Revenue</div><div className="stat__value" data-testid="historic-median-revenue">${median_revenue.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Cost</div><div className="stat__value">${(median_cost ?? 0).toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${(median_profit ?? 0).toFixed(2)}</div></div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
      {tab === 'session' && (
        <div>
          {loading && sessions.length === 0 ? <div className="spinner">⏳</div> : (
            <>
              {sessions.length === 0 ? (
                <div className="card"><div className="empty">No register sessions found</div></div>
              ) : (
                <>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label className="label">Session</label>
                    <select
                      data-testid="session-selector"
                      className="input"
                      value={selectedSessionId ?? ''}
                      onChange={e => { setSelectedSessionId(Number(e.target.value)); setSessionReport(null); }}
                    >
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          #{s.id} — {new Date(s.opened_at).toLocaleDateString()} {new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {s.status === 'open' ? ' (open)' : s.closed_at ? ` → ${new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {loading && <div className="spinner">⏳</div>}

                  {!loading && sessionReport && (() => {
                    const { session: s, order_count, revenue, total_cost, gross_profit, cash_sales, card_sales, by_item, cashouts, restocked, adjustments, payments } = sessionReport;

                    // Build inventory comparison table from snapshots
                    const openSnap = s.inventory_snapshot_open;
                    const closeSnap = s.inventory_snapshot_close;
                    const snapProducts = openSnap?.products ?? closeSnap?.products ?? [];
                    const inventoryRows = snapProducts.map(p => {
                      const openUnits = openSnap?.products.find(x => x.id === p.id)?.units ?? null;
                      const closeUnits = closeSnap?.products.find(x => x.id === p.id)?.units ?? null;
                      const sold = by_item.find(i => i.product_id === p.id)?.units_sold ?? 0;
                      const stocked = restocked.find(r => r.product_id === p.id)?.units_restocked ?? 0;
                      const adj = adjustments.find(a => a.product_id === p.id)?.delta ?? 0;
                      return { id: p.id, name: p.name, openUnits, closeUnits, sold, stocked, adj };
                    }).filter(r => r.sold > 0 || r.stocked > 0 || r.adj !== 0 || r.openUnits !== r.closeUnits);

                    return (
                      <>
                        {/* Session info */}
                        <div className="card">
                          <div className="card__title">Session #{s.id} — {s.status === 'open' ? <span className="badge badge--open">OPEN</span> : <span className="badge badge--paid">CLOSED</span>}</div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.9rem', marginTop: 8, color: 'var(--text-secondary)' }}>
                            <span>Opened: {new Date(s.opened_at).toLocaleString()}</span>
                            {s.closed_at && <span>Closed: {new Date(s.closed_at).toLocaleString()}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.9rem', marginTop: 4 }}>
                            <span>Opening cash: <strong>${s.opening_cash.toFixed(2)}</strong></span>
                            {s.closing_cash != null && <span>Closing cash: <strong>${s.closing_cash.toFixed(2)}</strong></span>}
                          </div>
                          {isAdmin && s.status === 'closed' && sessions[0]?.id === s.id && (
                            <div style={{ marginTop: 12 }}>
                              {reopenError && <div className="error-banner" style={{ marginBottom: 8 }}>{reopenError}</div>}
                              <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => handleReopen(s.id)}
                                disabled={reopenLoading}
                              >
                                {reopenLoading ? 'Reopening…' : 'Reopen Session'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Tab exclusion notice */}
                        <div data-testid="session-tab-notice" style={{ background: 'var(--surface-secondary, #f3f4f6)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                          Tab sales are not included — tabs may span multiple sessions and are tracked separately.
                        </div>

                        {/* Sales stats */}
                        <div className="stats" data-testid="session-report-stats">
                          <div className="stat"><div className="stat__label">Orders</div><div className="stat__value">{order_count}</div></div>
                          <div className="stat"><div className="stat__label">Revenue</div><div className="stat__value">${revenue.toFixed(2)}</div></div>
                          <div className="stat"><div className="stat__label">Cash</div><div className="stat__value">${cash_sales.toFixed(2)}</div></div>
                          <div className="stat"><div className="stat__label">Card</div><div className="stat__value">${card_sales.toFixed(2)}</div></div>
                          {(sessionReport.transfer_sales ?? 0) > 0 && (
                            <div className="stat"><div className="stat__label">Transfer</div><div className="stat__value">${(sessionReport.transfer_sales ?? 0).toFixed(2)}</div></div>
                          )}
                          <div className="stat"><div className="stat__label">Cost</div><div className="stat__value">${total_cost.toFixed(2)}</div></div>
                          {(sessionReport.commission_total ?? 0) > 0 && (
                            <div className="stat"><div className="stat__label">Commissions</div><div className="stat__value" style={{ color: '#f59e0b' }}>−${(sessionReport.commission_total ?? 0).toFixed(2)}</div></div>
                          )}
                          <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${gross_profit.toFixed(2)}</div></div>
                        </div>

                        {/* Cash reconciliation */}
                        {sessionReport.expected_cash != null && (
                          <div className="card" data-testid="session-cash-reconciliation">
                            <div className="card__title">Cash Reconciliation</div>
                            <div className="stats" style={{ marginTop: 8 }}>
                              <div className="stat">
                                <div className="stat__label">Expected</div>
                                <div className="stat__value">${sessionReport.expected_cash.toFixed(2)}</div>
                              </div>
                              {s.closing_cash != null && (
                                <div className="stat">
                                  <div className="stat__label">Counted</div>
                                  <div className="stat__value">${s.closing_cash.toFixed(2)}</div>
                                </div>
                              )}
                              {sessionReport.cash_variance != null && (
                                <div className="stat">
                                  <div className="stat__label">{sessionReport.cash_variance === 0 ? 'Balanced' : sessionReport.cash_variance > 0 ? 'Over' : 'Short'}</div>
                                  <div className="stat__value" style={{ color: sessionReport.cash_variance === 0 ? 'var(--success)' : sessionReport.cash_variance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {sessionReport.cash_variance === 0 ? '—' : `${sessionReport.cash_variance > 0 ? '+' : ''}$${sessionReport.cash_variance.toFixed(2)}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Digital reconciliation */}
                        {sessionReport.expected_digital != null && (
                          <div className="card" data-testid="session-digital-reconciliation">
                            <div className="card__title">Digital Reconciliation</div>
                            <div className="stats" style={{ marginTop: 8 }}>
                              <div className="stat">
                                <div className="stat__label">Expected</div>
                                <div className="stat__value">${sessionReport.expected_digital.toFixed(2)}</div>
                              </div>
                              {sessionReport.actual_digital != null && (
                                <div className="stat">
                                  <div className="stat__label">Actual</div>
                                  <div className="stat__value">${sessionReport.actual_digital.toFixed(2)}</div>
                                </div>
                              )}
                              {sessionReport.digital_variance != null && (
                                <div className="stat">
                                  <div className="stat__label">{sessionReport.digital_variance === 0 ? 'Balanced' : sessionReport.digital_variance > 0 ? 'Over' : 'Short'}</div>
                                  <div className="stat__value" style={{ color: sessionReport.digital_variance === 0 ? 'var(--success)' : sessionReport.digital_variance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {sessionReport.digital_variance === 0 ? '—' : `${sessionReport.digital_variance > 0 ? '+' : ''}$${sessionReport.digital_variance.toFixed(2)}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Reconciliation narrative */}
                        {s.status === 'closed' && sessionReport.reconciliation_summary && (
                          <ReconciliationNarrative report={sessionReport} />
                        )}

                        {/* Post-close reconciliation (correction path) */}
                        {s.status === 'closed' && (
                          <ReconciliationCard
                            sessionId={s.id}
                            report={sessionReport}
                            onSaved={() => setReportRefreshKey(k => k + 1)}
                          />
                        )}

                        {/* Inventory comparison */}
                        {(openSnap || closeSnap) && inventoryRows.length > 0 && (
                          <div className="card">
                            <div className="card__title">Inventory Activity</div>
                            {!openSnap && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Opening snapshot not available for this session.</div>}
                            {!closeSnap && s.status === 'closed' && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Closing snapshot not available for this session.</div>}
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600 }}>Product</th>
                                    {openSnap && <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Opening</th>}
                                    {closeSnap && <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Closing</th>}
                                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Sold</th>
                                    {restocked.length > 0 && <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Restocked</th>}
                                    {adjustments.length > 0 && <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Adjusted</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {inventoryRows.map(r => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '5px 8px 5px 0' }}>{r.name}</td>
                                      {openSnap && <td style={{ textAlign: 'right', padding: '5px 6px' }}>{r.openUnits ?? '—'}</td>}
                                      {closeSnap && <td style={{ textAlign: 'right', padding: '5px 6px' }}>{r.closeUnits ?? '—'}</td>}
                                      <td style={{ textAlign: 'right', padding: '5px 6px', color: r.sold > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>{r.sold > 0 ? r.sold : '—'}</td>
                                      {restocked.length > 0 && <td style={{ textAlign: 'right', padding: '5px 6px', color: r.stocked > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>{r.stocked > 0 ? `+${r.stocked}` : '—'}</td>}
                                      {adjustments.length > 0 && <td style={{ textAlign: 'right', padding: '5px 6px', color: r.adj > 0 ? 'var(--success)' : r.adj < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{r.adj !== 0 ? (r.adj > 0 ? `+${r.adj}` : r.adj) : '—'}</td>}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* By item */}
                        {by_item.length > 0 && (
                          <div className="card">
                            <div className="card__title">Sales by Product</div>
                            {by_item.map(i => (
                              <div className="list-item" key={i.product_id}>
                                <div className="list-item__main">
                                  <div className="list-item__name">{i.name}</div>
                                  <div className="list-item__sub">{i.units_sold} units · cost ${i.cost.toFixed(2)} · profit ${i.profit.toFixed(2)}</div>
                                </div>
                                <div className="list-item__right" style={{ fontWeight: 700 }}>${i.revenue.toFixed(2)}</div>
                              </div>
                            ))}
                            {by_item.length === 0 && <div className="empty">No orders in this session</div>}
                          </div>
                        )}
                        {by_item.length === 0 && <div className="card"><div className="empty">No orders in this session</div></div>}

                        {/* Cashouts */}
                        {cashouts.length > 0 && (
                          <div className="card">
                            <div className="card__title">Cash Removals</div>
                            {cashouts.map(c => (
                              <div className="list-item" key={c.id}>
                                <div className="list-item__main">
                                  <div className="list-item__name">{c.reason || 'No reason given'}</div>
                                  <div className="list-item__sub">{new Date(c.created_at).toLocaleString()}</div>
                                </div>
                                <div className="list-item__right" style={{ fontWeight: 700, color: 'var(--danger)' }}>−${c.amount.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Unclaimed payments — orphaned entries within this session's time window */}
                        {sessionReport.unlinked_payments?.length > 0 && (
                          <UnclaimedPaymentsCard
                            sessionId={s.id}
                            entries={sessionReport.unlinked_payments}
                            onClaimed={() => setReportRefreshKey(k => k + 1)}
                          />
                        )}

                        {/* Payments linked to this session */}
                        {payments && payments.length > 0 && (
                          <div className="card">
                            <div className="card__title">Payments</div>
                            {payments.map(p => {
                              const typeLabel = p.entry_type === 'payroll' ? 'Staff' : p.entry_type === 'savings_transfer' ? 'Savings' : 'Expense';
                              return (
                                <div className="list-item" key={p.id}>
                                  <div className="list-item__main">
                                    <div className="list-item__name">{p.description}</div>
                                    <div className="list-item__sub" style={{ display: 'flex', gap: 8 }}>
                                      <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>{typeLabel}</span>
                                      <span>{new Date(p.created_at).toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <div className="list-item__right" style={{ fontWeight: 700, color: 'var(--danger)' }}>−${Math.abs(p.amount).toFixed(2)}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* P&L Summary */}
                        {sessionReport.pnl && (() => {
                          const pnl = sessionReport.pnl;
                          const rows: { label: string; value: number; indent?: boolean; separator?: boolean; bold?: boolean }[] = [
                            { label: 'Revenue (orders)', value: sessionReport.revenue },
                            { label: 'Revenue (tabs)', value: pnl.tab_revenue, indent: true },
                            { label: 'Total Revenue', value: pnl.revenue, bold: true },
                            { label: 'Cost of Goods', value: -pnl.cogs, indent: true },
                            { label: 'Card Commissions', value: -pnl.commissions, indent: true },
                            { label: 'Gross Profit', value: pnl.gross_profit, bold: true },
                          ];
                          if (pnl.payroll > 0)            rows.push({ label: 'Payroll', value: -pnl.payroll, indent: true });
                          if (pnl.expenses > 0)           rows.push({ label: 'Expenses', value: -pnl.expenses, indent: true });
                          if (pnl.writeoffs > 0)          rows.push({ label: 'Write-offs', value: -pnl.writeoffs, indent: true });
                          if (pnl.inventory_adjustment !== 0) rows.push({ label: 'Inventory Adjustment', value: pnl.inventory_adjustment, indent: true });
                          rows.push({ label: 'Net Session Result', value: pnl.net, bold: true });
                          return (
                            <div className="card" data-testid="session-pnl" id="session-pnl">
                              <div className="card__title">P&amp;L Summary</div>
                              <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse', marginTop: 8 }}>
                                <tbody>
                                  {rows.map((row, i) => (
                                    <tr key={i} style={{ borderTop: row.bold ? '1px solid var(--border)' : undefined }}>
                                      <td style={{ padding: '5px 0 5px', paddingLeft: row.indent ? 16 : 0, color: row.bold ? undefined : 'var(--text-secondary)', fontWeight: row.bold ? 700 : undefined }}>
                                        {row.label}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: row.bold ? 700 : undefined, color: row.bold && row.value < 0 ? 'var(--danger)' : row.bold && row.value > 0 ? 'var(--success)' : row.value < 0 ? 'var(--danger)' : undefined }}>
                                        {row.value >= 0 ? `$${row.value.toFixed(2)}` : `−$${Math.abs(row.value).toFixed(2)}`}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}

                        {/* Print button */}
                        <div className="no-print" style={{ marginTop: 8 }}>
                          <button className="btn btn--ghost" onClick={() => window.print()}>
                            Print / Save as PDF
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'weekday' && (
        <div>
          {loading && <div className="spinner">⏳</div>}
          {!loading && weekdayReport && (() => {
            const { periods, best_index, year } = weekdayReport;
            const best = periods[best_index];
            const hasData = periods.some(p => p.median_revenue > 0);

            // Map to HistoricPeriod shape so ColumnChart can render
            const chartPeriods = periods.map(p => ({
              label: p.label,
              period_start: String(p.dow),
              period_end: String(p.dow),
              revenue: p.median_revenue,
              cost: p.median_cost,
              profit: p.median_profit,
              order_count: p.sample_days,
            }));

            return (
              <>
                <div style={{ marginBottom: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                  Median sales by day of week — {year} · based on actual sales days only
                </div>

                {hasData ? (
                  <div className="card" style={{ padding: '12px 8px 8px' }} data-testid="weekday-chart">
                    <ColumnChart
                      periods={chartPeriods}
                      groupBy="month"
                      bestIndex={best_index}
                      medianRevenue={null}
                    />
                  </div>
                ) : (
                  <div className="card"><div className="empty">No sales data for {year}</div></div>
                )}

                {hasData && best && (
                  <div className="card" style={{ marginTop: 10 }} data-testid="weekday-best">
                    <div className="card__title">★ Best Day — {best.label}</div>
                    <div className="stats" style={{ marginTop: 8 }}>
                      <div className="stat"><div className="stat__label">Med. Revenue</div><div className="stat__value" data-testid="weekday-best-revenue">${best.median_revenue.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Med. Cost</div><div className="stat__value">${best.median_cost.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Med. Profit</div><div className="stat__value">${best.median_profit.toFixed(2)}</div></div>
                      <div className="stat"><div className="stat__label">Sample days</div><div className="stat__value">{best.sample_days}</div></div>
                    </div>
                  </div>
                )}

                {hasData && (
                  <div className="card" style={{ marginTop: 10 }} data-testid="weekday-table">
                    <div className="card__title">All Days</div>
                    {periods.map((p, i) => (
                      <div className="list-item" key={p.dow} style={{ background: i === best_index ? 'var(--surface-hover, rgba(251,191,36,0.06))' : undefined }}>
                        <div className="list-item__main">
                          <div className="list-item__name" style={{ fontWeight: i === best_index ? 700 : undefined }}>
                            {i === best_index ? '★ ' : ''}{p.label}
                          </div>
                          <div className="list-item__sub">{p.sample_days} {p.sample_days === 1 ? 'day' : 'days'} of data</div>
                        </div>
                        <div className="list-item__right">
                          <div style={{ fontWeight: 700 }}>${p.median_revenue.toFixed(2)}</div>
                          <div className="list-item__sub">profit ${p.median_profit.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
