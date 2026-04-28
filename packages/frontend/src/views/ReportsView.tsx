import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SalesByItem, DailyTotal, DailyRange, CloseBrief, InventoryAdjustmentItem, HistoricReport, WeekdayReport, RegisterSessionSummary, SessionReport } from '../api/client';
import ColumnChart from '../components/ColumnChart';

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: localTz });

export default function ReportsView() {
  const [tab, setTab] = useState<'sales' | 'range' | 'brief' | 'historic' | 'weekday' | 'session'>('sales');
  const [salesFrom, setSalesFrom] = useState(today());
  const [salesTo, setSalesTo] = useState(today());
  const [salesByItem, setSalesByItem] = useState<SalesByItem[]>([]);
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [adjItems, setAdjItems] = useState<InventoryAdjustmentItem[]>([]);
  const [dailyRange, setDailyRange] = useState<DailyRange[]>([]);
  const [closeBrief, setCloseBrief] = useState<CloseBrief | null>(null);
  const [rangeFrom, setRangeFrom] = useState(today());
  const [rangeTo, setRangeTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historicGroupBy, setHistoricGroupBy] = useState<'week' | 'month' | 'day'>('week');
  const [historicReport, setHistoricReport] = useState<HistoricReport | null>(null);
  const [weekdayReport, setWeekdayReport] = useState<WeekdayReport | null>(null);
  const [sessions, setSessions] = useState<RegisterSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);

  async function fetchSales() {
    setLoading(true); setError('');
    try {
      const [items, totals, adjs] = await Promise.all([
        api.getSalesByItem(salesFrom, salesTo, localTz),
        api.getDailyTotal(salesFrom, salesTo, localTz),
        api.getInventoryAdjustmentReport(salesFrom, salesTo, localTz),
      ]);
      setSalesByItem(items);
      setDailyTotal(totals);
      setAdjItems(adjs);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchRange() {
    setLoading(true); setError('');
    try { setDailyRange(await api.getDailyRange(rangeFrom, rangeTo, localTz)); }
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

  useEffect(() => { if (tab === 'sales') fetchSales(); }, [tab, salesFrom, salesTo]);
  useEffect(() => { if (tab === 'range') fetchRange(); }, [tab]);
  useEffect(() => { if (tab === 'brief') fetchBrief(); }, [tab]);
  useEffect(() => { if (tab === 'historic') fetchHistoric(); }, [tab, historicGroupBy]);
  useEffect(() => { if (tab === 'weekday') fetchWeekday(); }, [tab]);
  useEffect(() => { if (tab === 'session') fetchSessions(); }, [tab]);
  useEffect(() => { if (selectedSessionId !== null) fetchSessionReport(selectedSessionId); }, [selectedSessionId]);

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
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><label className="label">From</label><input className="input" type="date" value={salesFrom} onChange={e => setSalesFrom(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">To</label><input className="input" type="date" value={salesTo} onChange={e => setSalesTo(e.target.value)} /></div>
          </div>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><label className="label">From</label><input className="input" type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">To</label><input className="input" type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} /></div>
          </div>
          <button className="btn btn--primary btn--sm" style={{ marginBottom: 12 }} onClick={fetchRange}>Fetch</button>
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
                    const { session: s, order_count, revenue, total_cost, gross_profit, cash_sales, card_sales, by_item, cashouts, restocked, adjustments } = sessionReport;

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
                          <div className="stat"><div className="stat__label">Cost</div><div className="stat__value">${total_cost.toFixed(2)}</div></div>
                          {(sessionReport.commission_total ?? 0) > 0 && (
                            <div className="stat"><div className="stat__label">Commissions</div><div className="stat__value" style={{ color: '#f59e0b' }}>−${(sessionReport.commission_total ?? 0).toFixed(2)}</div></div>
                          )}
                          <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${gross_profit.toFixed(2)}</div></div>
                        </div>

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
