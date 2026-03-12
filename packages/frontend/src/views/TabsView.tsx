import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Tab, TabItem, Product } from '../api/client';

export default function TabsView() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTab, setSelectedTab] = useState<(Tab & { items?: TabItem[] }) | null>(null);
  const [tabName, setTabName] = useState('');
  const [atCost, setAtCost] = useState(false);
  const [payMethod, setPayMethod] = useState<'cash' | 'card'>('card');
  const [cashReceived, setCashReceived] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [closedPage, setClosedPage] = useState(0);
  const PAGE_SIZE = 10;

  async function loadTabs(resetPage = false) {
    try {
      setTabs(await api.getTabs());
      if (resetPage) setClosedPage(0);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadTabs();
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  async function openTab(t: Tab) {
    // Show the tab immediately with basic data, then load items in background
    setSelectedTab(t as Tab & { items?: TabItem[] });
    setError(''); setSuccess('');
    setCashReceived(''); setPayMethod('card');
    setView('detail');
    try {
      const full = await api.getTab(t.id);
      setSelectedTab(full);
    } catch { /* ignore */ }
  }

  async function handleCreateTab() {
    setError('');
    try {
      const tab = await api.openTab(tabName, atCost);
      setTabName(''); setAtCost(false);
      await loadTabs();
      await openTab(tab);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleAddProduct(product: Product) {
    if (!selectedTab) return;
    setError('');
    try {
      const updated = await api.addTabItems(selectedTab.id, [{ product_id: product.id, quantity: 1 }]);
      setSelectedTab(updated);
      loadTabs();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handlePayTab() {
    if (!selectedTab) return;
    setError('');
    try {
      await api.payTab(selectedTab.id, payMethod, payMethod === 'cash' ? Number(cashReceived) : undefined);
      setSelectedTab(null);
      setView('list');
      await loadTabs(true);
      setSuccess('Tab paid!');
    } catch (e: unknown) { setError((e as Error).message); }
  }

  const openTabs = tabs.filter(t => t.status === 'open');
  const closedTabs = tabs.filter(t => t.status !== 'open');
  const closedPageCount = Math.ceil(closedTabs.length / PAGE_SIZE);
  const closedPagedTabs = closedTabs.slice(closedPage * PAGE_SIZE, (closedPage + 1) * PAGE_SIZE);

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      <div className="tabs-nav">
        <button className={`tabs-nav__item${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>Tabs</button>
        <button className={`tabs-nav__item${view === 'new' ? ' active' : ''}`} onClick={() => setView('new')}>+ New Tab</button>
      </div>

      {view === 'list' && (
        <div>
          <div className="stats">
            <div className="stat"><div className="stat__label">Open Tabs</div><div className="stat__value" data-testid="open-tab-count">{openTabs.length}</div></div>
            <div className="stat"><div className="stat__label">Open Total</div><div className="stat__value">${openTabs.reduce((s, t) => s + t.total, 0).toFixed(2)}</div></div>
          </div>

          <p className="section-title">Open Tabs</p>
          <div className="card">
            {openTabs.length === 0 ? <div className="empty">No open tabs</div> : openTabs.map(t => (
              <div className="list-item list-item--tappable" key={t.id} data-testid="tab-item"
                onClick={() => openTab(t)} style={{ cursor: 'pointer' }}>
                <div className="list-item__main">
                  <div className="list-item__name" data-testid="tab-name">{t.name || `Tab #${t.id}`}</div>
                  <div className="list-item__sub">{t.created_at.slice(0, 10)}</div>
                </div>
                <div className="list-item__right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>${t.total.toFixed(2)}</div>
                  <button data-testid={`view-tab-${t.id}`} className="btn btn--sm btn--ghost"
                    onClick={e => { e.stopPropagation(); openTab(t); }}>View →</button>
                </div>
              </div>
            ))}
          </div>

          {closedTabs.length > 0 && (
            <>
              <p className="section-title">Closed Tabs ({closedTabs.length})</p>
              <div className="card">
                {closedPagedTabs.map(t => (
                  <div className="list-item" key={t.id}>
                    <div className="list-item__main">
                      <div className="list-item__name">{t.name || `Tab #${t.id}`}</div>
                      {t.paid_at && (
                        <div className="list-item__sub">
                          Paid {t.paid_at.slice(0, 10)} at {t.paid_at.slice(11, 16)}
                        </div>
                      )}
                    </div>
                    <div className="list-item__right" style={{ textAlign: 'right' }}>
                      <span className="badge badge--paid">PAID</span>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>${t.total.toFixed(2)}</div>
                      {t.payment_method && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{t.payment_method.replace('_', ' ')}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {closedPageCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => setClosedPage(p => Math.max(0, p - 1))}
                    disabled={closedPage === 0}
                  >← Prev</button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Page {closedPage + 1} of {closedPageCount}
                  </span>
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => setClosedPage(p => Math.min(closedPageCount - 1, p + 1))}
                    disabled={closedPage >= closedPageCount - 1}
                  >Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === 'new' && (
        <div className="card">
          <div className="card__title">Open New Tab</div>
          <div className="field">
            <label className="label">Table / Name</label>
            <input data-testid="tab-name-input" className="input" placeholder="Table 4…"
              value={tabName} onChange={e => setTabName(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}>
            <input
              data-testid="at-cost-toggle"
              type="checkbox"
              checked={atCost}
              onChange={e => setAtCost(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '0.95rem' }}>
              Sell at cost <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>(staff drink)</span>
            </span>
          </label>
          <button data-testid="open-tab-btn" className="btn btn--primary" onClick={handleCreateTab} disabled={!tabName}>Open Tab</button>
        </div>
      )}

      {view === 'detail' && selectedTab && (
        <div>
          <button className="btn btn--ghost" style={{ marginBottom: 12 }} onClick={() => { setView('list'); setSelectedTab(null); }}>← All Tabs</button>

          <div className="card">
            <div className="card__title">{selectedTab.name}</div>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }} data-testid="tab-total">Total: ${selectedTab.total.toFixed(2)}</div>
            <span className={`badge badge--${selectedTab.status}`}>{selectedTab.status.toUpperCase()}</span>
          </div>

          {selectedTab.at_cost ? (
            <div data-testid="at-cost-banner" style={{
              background: '#fef08a', color: '#713f12',
              borderRadius: 12, padding: '16px 20px',
              textAlign: 'center', marginBottom: 12,
              border: '2px solid #ca8a04'
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: 2 }}>⚠️ STAFF COST PRICE</div>
              <div style={{ fontSize: '0.9rem', marginTop: 4 }}>Items are charged at cost — not for sale to customers</div>
            </div>
          ) : null}

          {selectedTab.status === 'open' && (
            <>
              <div className="card">
                <div className="card__title">Add Items</div>
                {products.map(p => (
                  <div className="list-item" key={p.id}>
                    <div className="list-item__main">
                      <div className="list-item__name">{p.name}</div>
                      <div className="list-item__sub">
                        ${selectedTab.at_cost ? p.cost.toFixed(2) : p.price.toFixed(2)}
                        {selectedTab.at_cost ? <span style={{ marginLeft: 4, fontSize: '0.75rem', color: '#92400e' }}>(cost)</span> : null}
                      </div>
                    </div>
                    <button data-testid={`tab-add-${p.name.toLowerCase().replace(/\s+/g,'-')}`}
                      className="btn btn--sm btn--primary" onClick={() => handleAddProduct(p)}>+</button>
                  </div>
                ))}
              </div>

              {selectedTab.items && selectedTab.items.length > 0 && (
                <div className="card" data-testid="tab-items">
                  <div className="card__title">On the Tab</div>
                  {selectedTab.items.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <div className="list-item" key={item.id}>
                        <div className="list-item__main">
                          <div className="list-item__name">{product?.name ?? `Product #${item.product_id}`}</div>
                          <div className="list-item__sub">× {item.quantity} @ ${item.unit_price.toFixed(2)}</div>
                        </div>
                        <div className="list-item__right" style={{ fontWeight: 600 }}>${item.subtotal.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="card">
                <div className="card__title">Pay Tab</div>
                <div className="tabs-nav">
                  <button className={`tabs-nav__item${payMethod === 'card' ? ' active' : ''}`} onClick={() => setPayMethod('card')}>Card</button>
                  <button className={`tabs-nav__item${payMethod === 'cash' ? ' active' : ''}`} onClick={() => setPayMethod('cash')}>Cash</button>
                </div>
                {payMethod === 'cash' && (
                  <div className="field">
                    <label className="label">Amount Received ($)</label>
                    <input data-testid="tab-cash-input" className="input" type="number" min="0" step="0.01"
                      value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
                  </div>
                )}
                <button data-testid="pay-tab-btn" className="btn btn--success"
                  onClick={handlePayTab} disabled={payMethod === 'cash' && !cashReceived}>
                  Pay Tab (${selectedTab.total.toFixed(2)})
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
