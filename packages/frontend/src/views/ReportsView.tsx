import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SalesByItem, DailyTotal, DailyRange, CloseBrief } from '../api/client';

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportsView() {
  const [tab, setTab] = useState<'sales' | 'daily' | 'range' | 'brief'>('sales');
  const [date, setDate] = useState(today());
  const [salesByItem, setSalesByItem] = useState<SalesByItem[]>([]);
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [dailyRange, setDailyRange] = useState<DailyRange[]>([]);
  const [closeBrief, setCloseBrief] = useState<CloseBrief | null>(null);
  const [rangeFrom, setRangeFrom] = useState(today());
  const [rangeTo, setRangeTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchSales() {
    setLoading(true); setError('');
    try { setSalesByItem(await api.getSalesByItem(date)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchDaily() {
    setLoading(true); setError('');
    try { setDailyTotal(await api.getDailyTotal(date)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchRange() {
    setLoading(true); setError('');
    try { setDailyRange(await api.getDailyRange(rangeFrom, rangeTo)); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function fetchBrief() {
    setLoading(true); setError('');
    try { setCloseBrief(await api.getCloseBriefReport()); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (tab === 'sales') fetchSales(); }, [tab]);
  useEffect(() => { if (tab === 'daily') fetchDaily(); }, [tab]);
  useEffect(() => { if (tab === 'range') fetchRange(); }, [tab]);
  useEffect(() => { if (tab === 'brief') fetchBrief(); }, [tab]);

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      <div className="tabs-nav">
        <button className={`tabs-nav__item${tab === 'sales' ? ' active' : ''}`} onClick={() => setTab('sales')}>By Item</button>
        <button className={`tabs-nav__item${tab === 'daily' ? ' active' : ''}`} onClick={() => setTab('daily')}>Daily</button>
        <button className={`tabs-nav__item${tab === 'range' ? ' active' : ''}`} onClick={() => setTab('range')}>Range</button>
        <button className={`tabs-nav__item${tab === 'brief' ? ' active' : ''}`} onClick={() => setTab('brief')}>Brief</button>
      </div>

      {tab === 'sales' && (
        <div>
          <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button className="btn btn--primary btn--sm" onClick={fetchSales} style={{ marginBottom: 0 }}>Go</button>
          </div>
          <div className="card" data-testid="sales-by-item">
            {loading ? <div className="spinner">⏳</div> : salesByItem.length === 0 ? <div className="empty">No sales for this date</div> :
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
        </div>
      )}

      {tab === 'daily' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button className="btn btn--primary btn--sm" onClick={fetchDaily}>Go</button>
          </div>
          {dailyTotal && (
            <div className="stats" data-testid="daily-total">
              <div className="stat"><div className="stat__label">Orders</div><div className="stat__value" data-testid="order-count">{dailyTotal.order_count}</div></div>
              <div className="stat"><div className="stat__label">Sales</div><div className="stat__value" data-testid="total-sales">${dailyTotal.total_sales.toFixed(2)}</div></div>
              <div className="stat"><div className="stat__label">Cash</div><div className="stat__value" data-testid="cash-sales">${Number(dailyTotal.cash_sales ?? 0).toFixed(2)}</div></div>
              <div className="stat"><div className="stat__label">Card</div><div className="stat__value" data-testid="card-sales">${Number(dailyTotal.card_sales ?? 0).toFixed(2)}</div></div>
              <div className="stat"><div className="stat__label">Cost</div><div className="stat__value">${dailyTotal.total_cost.toFixed(2)}</div></div>
              <div className="stat"><div className="stat__label">Profit</div><div className="stat__value">${(dailyTotal.total_sales - dailyTotal.total_cost).toFixed(2)}</div></div>
            </div>
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
    </div>
  );
}
