import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Discount, Tab, TabItem, Product } from '../api/client';
import PinModal from '../components/PinModal';
import ReceiptModal, { type ReceiptLine, type ReceiptDiscount } from '../components/ReceiptModal';
import ProductThumb from '../components/ProductThumb';
import ProductPicker from '../components/ProductPicker';
import { computeSavings, getBestAutoDiscount } from '../lib/discounts';
import type { CartItem } from '../lib/discounts';

function TabItemsSummary({ items, testId }: { items?: TabItem[]; testId?: string }) {
  if (!items || items.length === 0) return <div className="list-item__sub" style={{ fontStyle: 'italic' }} data-testid={testId}>Empty</div>;
  const MAX = 4;
  const visible = items.slice(0, MAX);
  const extra = items.length - MAX;
  const text = visible.map(i => `${i.name ?? `#${i.product_id}`} ×${i.quantity}`).join(' · ');
  return (
    <div className="list-item__sub" style={{ marginTop: 2 }} data-testid={testId}>
      {text}{extra > 0 ? ` · +${extra} more` : ''}
    </div>
  );
}

interface Receipt {
  timestamp: Date;
  lines: ReceiptLine[];
  subtotal: number;
  discountLine: ReceiptDiscount | null;
  total: number;
  changeDue: number | null;
}

export default function TabsView() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTab, setSelectedTab] = useState<(Tab & { items?: TabItem[] }) | null>(null);
  const [tabName, setTabName] = useState('');
  const [atCost, setAtCost] = useState(false);
  const [payStep, setPayStep] = useState<'form' | 'cash'>('form');
  const [cashReceived, setCashReceived] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [closedPage, setClosedPage] = useState(0);
  const [showPinForTab, setShowPinForTab] = useState(false);
  const [showPinForVoid, setShowPinForVoid] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [soldCounts, setSoldCounts] = useState<Record<number, number>>({});
  const [addViewMode, setAddViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('tabs-add-view') as 'grid' | 'list' | null) ?? 'list';
  });
  const [addSearch, setAddSearch] = useState('');
  const PAGE_SIZE = 10;

  // Discounts
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  // undefined = use auto, null = cashier explicitly removed, object = cashier explicitly chose
  const [manualDiscountOverride, setManualDiscountOverride] = useState<
    { discount: Discount; savings: number } | null | undefined
  >(undefined);
  const [showCourtesyPin, setShowCourtesyPin] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);

  function setAddView(mode: 'grid' | 'list') {
    setAddViewMode(mode);
    localStorage.setItem('tabs-add-view', mode);
  }

  function refreshSoldCounts() {
    api.getTopProducts().then(rows => {
      setSoldCounts(Object.fromEntries(rows.map(r => [r.product_id, r.units_sold])));
    }).catch(() => {});
  }

  async function loadTabs(resetPage = false) {
    try {
      setTabs(await api.getTabs());
      if (resetPage) setClosedPage(0);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadTabs();
    api.getProducts().then(setProducts).catch(() => {});
    refreshSoldCounts();
    api.getDiscounts().then(setDiscounts).catch(() => {});
  }, []);

  async function openTab(t: Tab) {
    setSelectedTab(t as Tab & { items?: TabItem[] });
    setError(''); setCashReceived(''); setPayStep('form');
    setManualDiscountOverride(undefined);
    setView('detail');
    api.getProducts().then(setProducts).catch(() => {});
    try {
      const full = await api.getTab(t.id);
      setSelectedTab(stableItems(full));
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

  function adjustProductUnits(productId: number, delta: number) {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, units: Math.max(0, p.units - delta) } : p));
  }

  async function handleAddProduct(product: Product) {
    if (!selectedTab) return;
    setError('');
    adjustProductUnits(product.id, 1);
    try {
      const updated = await api.addTabItems(selectedTab.id, [{ product_id: product.id, quantity: 1 }]);
      setSelectedTab(stableItems(updated));
      loadTabs();
    } catch (e: unknown) {
      adjustProductUnits(product.id, -1);
      setError((e as Error).message);
    }
  }

  async function handleUpdateItemQuantity(itemId: number, quantity: number) {
    if (!selectedTab) return;
    setError('');
    const item = selectedTab.items?.find(i => i.id === itemId);
    const qtyDelta = item ? quantity - item.quantity : 0;
    if (item && qtyDelta !== 0) adjustProductUnits(item.product_id, qtyDelta);
    try {
      const updated = await api.updateTabItem(selectedTab.id, itemId, quantity);
      setSelectedTab(stableItems(updated));
      loadTabs();
    } catch (e: unknown) {
      if (item && qtyDelta !== 0) adjustProductUnits(item.product_id, -qtyDelta);
      setError((e as Error).message);
    }
  }

  // Sort items by id (insertion order) so the list never jumps after an update
  function stableItems<T extends Tab & { items?: TabItem[] }>(tab: T): T {
    if (!tab.items) return tab;
    return { ...tab, items: [...tab.items].sort((a, b) => a.id - b.id) };
  }

  function toReceiptLines(items: TabItem[]): ReceiptLine[] {
    return items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        id: item.id,
        name: product?.name ?? `Product #${item.product_id}`,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      };
    });
  }

  async function handlePayCard() {
    if (!selectedTab) return;
    setError('');
    const snapshot = { items: selectedTab.items ?? [], subtotal: selectedTab.total, activeDiscount: tabActiveDiscount };
    try {
      await api.payTab(selectedTab.id, 'card', undefined, snapshot.activeDiscount?.discount.id);
      const discountLine = snapshot.activeDiscount && snapshot.activeDiscount.savings > 0
        ? { name: snapshot.activeDiscount.discount.name, savings: snapshot.activeDiscount.savings }
        : null;
      const total = Math.max(0, snapshot.subtotal - (discountLine?.savings ?? 0));
      setReceipt({ timestamp: new Date(), lines: toReceiptLines(snapshot.items), subtotal: snapshot.subtotal, discountLine, total, changeDue: null });
      setSelectedTab(null);
      setManualDiscountOverride(undefined);
      await loadTabs(true);
      refreshSoldCounts();
      api.getDiscounts().then(setDiscounts).catch(() => {});
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handlePayCash() {
    if (!selectedTab) return;
    setError('');
    const snapshot = { items: selectedTab.items ?? [], subtotal: selectedTab.total, activeDiscount: tabActiveDiscount };
    const cash = Number(cashReceived);
    try {
      await api.payTab(selectedTab.id, 'cash', cash, snapshot.activeDiscount?.discount.id);
      const discountLine = snapshot.activeDiscount && snapshot.activeDiscount.savings > 0
        ? { name: snapshot.activeDiscount.discount.name, savings: snapshot.activeDiscount.savings }
        : null;
      const total = Math.max(0, snapshot.subtotal - (discountLine?.savings ?? 0));
      setReceipt({ timestamp: new Date(), lines: toReceiptLines(snapshot.items), subtotal: snapshot.subtotal, discountLine, total, changeDue: Math.max(0, cash - total) });
      setSelectedTab(null);
      setCashReceived('');
      setManualDiscountOverride(undefined);
      await loadTabs(true);
      refreshSoldCounts();
      api.getDiscounts().then(setDiscounts).catch(() => {});
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function handleCloseReceipt() {
    setReceipt(null);
    setView('list');
    setError('');
  }

  async function handleVoidTab() {
    if (!selectedTab) return;
    setError('');
    try {
      await api.voidTab(selectedTab.id);
      setSelectedTab(null);
      setView('list');
      await loadTabs(true);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  const prevTabTotal = useRef<number | null>(null);
  const [totalBump, setTotalBump] = useState(0);
  useEffect(() => {
    const t = selectedTab?.total ?? null;
    if (prevTabTotal.current !== null && prevTabTotal.current !== t) setTotalBump(b => b + 1);
    prevTabTotal.current = t;
  }, [selectedTab?.total]);

  const tabTotal = selectedTab?.total ?? 0;

  // Discount logic for the selected tab (none when at_cost)
  const tabCartItems: CartItem[] = (selectedTab?.items ?? []).map(i => ({
    product_id: i.product_id,
    price: i.unit_price,
    quantity: i.quantity,
  }));
  const tabAutoDiscount = selectedTab && !selectedTab.at_cost && tabCartItems.length > 0
    ? getBestAutoDiscount(discounts, tabCartItems)
    : null;
  const rawTabActive = manualDiscountOverride !== undefined ? manualDiscountOverride : tabAutoDiscount;
  const tabActiveDiscount = rawTabActive
    ? { discount: rawTabActive.discount, savings: computeSavings(rawTabActive.discount, tabCartItems) }
    : null;
  const tabEffectiveSavings = tabActiveDiscount && tabActiveDiscount.savings > 0 ? tabActiveDiscount.savings : 0;
  const tabEffectiveTotal = Math.max(0, tabTotal - tabEffectiveSavings);

  const manualDiscounts = discounts.filter(d => d.is_manual && d.active);

  const cashNum = Number(cashReceived) || 0;
  const liveChange = cashReceived !== '' ? cashNum - tabEffectiveTotal : null;

  const filteredAddProducts = addSearch.trim()
    ? products.filter(p => p.name.toLowerCase().includes(addSearch.toLowerCase()))
    : products;

  const openTabs = tabs.filter(t => t.status === 'open');
  const closedTabs = tabs.filter(t => t.status !== 'open');
  const closedPageCount = Math.ceil(closedTabs.length / PAGE_SIZE);
  const closedPagedTabs = closedTabs.slice(closedPage * PAGE_SIZE, (closedPage + 1) * PAGE_SIZE);

  return (
    <div>
      {showPinForTab && (
        <PinModal
          title="Staff Tab — Enter PIN"
          onConfirm={async (pin) => {
            await api.verifyPin(pin);
            setShowPinForTab(false);
            await handleCreateTab();
          }}
          onCancel={() => setShowPinForTab(false)}
        />
      )}

      {showPinForVoid && (
        <PinModal
          title="Close Tab — Enter PIN"
          onConfirm={async (pin) => {
            await api.verifyPin(pin);
            setShowPinForVoid(false);
            await handleVoidTab();
          }}
          onCancel={() => setShowPinForVoid(false)}
        />
      )}

      {showCourtesyPin && (
        <PinModal
          title="Courtesy Discount — Enter PIN"
          onConfirm={async (pin) => {
            await api.verifyPin(pin);
            setShowCourtesyPin(false);
            setShowManualPicker(true);
          }}
          onCancel={() => setShowCourtesyPin(false)}
        />
      )}

      {showManualPicker && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 360, margin: 0 }}>
            <div className="card__title">Apply Courtesy Discount</div>
            {manualDiscounts.map(d => (
              <button
                key={d.id}
                className="btn btn--ghost"
                style={{ marginBottom: 8, textAlign: 'left', justifyContent: 'flex-start' }}
                onClick={() => {
                  const savings = computeSavings(d, tabCartItems);
                  setManualDiscountOverride({ discount: d, savings });
                  setShowManualPicker(false);
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  {d.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d.description}</div>}
                </div>
              </button>
            ))}
            <button className="btn btn--ghost" style={{ marginTop: 4 }} onClick={() => setShowManualPicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {receipt && (
        <ReceiptModal
          timestamp={receipt.timestamp}
          lines={receipt.lines}
          subtotal={receipt.subtotal}
          discountLine={receipt.discountLine}
          total={receipt.total}
          changeDue={receipt.changeDue}
          onClose={handleCloseReceipt}
        />
      )}

      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}

      <div className="tabs-nav">
        <button className={`tabs-nav__item${view === 'list' ? ' active' : ''}`} onClick={() => { setView('list'); setPayStep('form'); }}>Tabs</button>
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
                onClick={() => openTab(t)} style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <div className="list-item__main" style={{ minWidth: 0 }}>
                  <div className="list-item__name" data-testid="tab-name">{t.name || `Tab #${t.id}`}</div>
                  <TabItemsSummary items={t.items} testId={`tab-items-summary-${t.id}`} />
                </div>
                <div className="list-item__right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  <div className="list-item" key={t.id} style={{ alignItems: 'flex-start' }}>
                    <div className="list-item__main" style={{ minWidth: 0 }}>
                      <div className="list-item__name">{t.name || `Tab #${t.id}`}</div>
                      <TabItemsSummary items={t.items} />
                      {t.paid_at && (
                        <div className="list-item__sub">
                          Paid {new Date(t.paid_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </div>
                    <div className="list-item__right" style={{ textAlign: 'right', flexShrink: 0 }}>
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
                  <button className="btn btn--sm btn--ghost" onClick={() => setClosedPage(p => Math.max(0, p - 1))} disabled={closedPage === 0}>← Prev</button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {closedPage + 1} of {closedPageCount}</span>
                  <button className="btn btn--sm btn--ghost" onClick={() => setClosedPage(p => Math.min(closedPageCount - 1, p + 1))} disabled={closedPage >= closedPageCount - 1}>Next →</button>
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
          <button data-testid="open-tab-btn" className="btn btn--primary"
            onClick={() => atCost ? setShowPinForTab(true) : handleCreateTab()}
            disabled={!tabName}>Open Tab</button>
        </div>
      )}

      {/* Cash payment step — rendered instead of detail when paying with cash */}
      {view === 'detail' && selectedTab && payStep === 'cash' && (
        <div>
          <button className="btn btn--ghost" style={{ marginBottom: 12 }}
            onClick={() => { setPayStep('form'); setError(''); setCashReceived(''); }}>
            ← Back to Tab
          </button>

          <div className="card" data-testid="tab-cash-payment-view">
            <div className="card__title">Cash Payment — {selectedTab.name}</div>

            {selectedTab.at_cost ? (
              <div style={{ background: '#fef08a', color: '#713f12', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', fontWeight: 600, border: '1px solid #ca8a04' }}>
                ⚠️ STAFF COST PRICE
              </div>
            ) : null}

            {(selectedTab.items ?? []).map(item => {
              const product = products.find(p => p.id === item.product_id);
              return (
                <div className="list-item" key={item.id} style={{ gap: 10 }}>
                  <ProductThumb image={product?.image} name={product?.name} size={36} />
                  <div className="list-item__main">
                    <div className="list-item__name">{product?.name ?? `Product #${item.product_id}`}</div>
                    <div className="list-item__sub">${item.unit_price.toFixed(2)} × {item.quantity}</div>
                  </div>
                  <div style={{ minWidth: 60, textAlign: 'right' }}>${item.subtotal.toFixed(2)}</div>
                </div>
              );
            })}

            {tabEffectiveSavings > 0 && tabActiveDiscount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, margin: '4px 0' }}>
                <span>🏷 {tabActiveDiscount.discount.name}</span>
                <span>−${tabEffectiveSavings.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', margin: '12px 0 16px' }}>
              <span>Total Due</span>
              <span>${tabEffectiveTotal.toFixed(2)}</span>
            </div>

            <div className="field">
              <label className="label">Amount Received ($)</label>
              <input
                data-testid="cash-received-input"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                autoFocus
              />
            </div>

            {liveChange !== null && (
              <div
                data-testid="live-change-amount"
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '14px 0',
                  color: liveChange >= 0 ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {liveChange >= 0
                  ? `Change: $${liveChange.toFixed(2)}`
                  : `Still needed: $${Math.abs(liveChange).toFixed(2)}`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn btn--ghost"
                style={{ width: 'auto', padding: '10px 16px' }}
                onClick={() => { setPayStep('form'); setError(''); setCashReceived(''); }}
              >
                ← Back
              </button>
              <button
                data-testid="confirm-payment-btn"
                className="btn btn--success"
                style={{ flex: 1 }}
                onClick={handlePayCash}
                disabled={!cashReceived || Number(cashReceived) < tabEffectiveTotal}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab detail view */}
      {view === 'detail' && selectedTab && payStep === 'form' && (
        <div>
          <button className="btn btn--ghost" style={{ marginBottom: 12 }} onClick={() => { setView('list'); setSelectedTab(null); }}>← All Tabs</button>

          <div className="card">
            <div className="card__title">{selectedTab.name}</div>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }} data-testid="tab-total">Total: <span key={totalBump} className="value-bump">${selectedTab.total.toFixed(2)}</span></div>
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
              <div className="card" data-testid="tab-items">
                <div className="card__title">On the Tab</div>
                <div style={{ height: '35vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                  {!selectedTab.items || selectedTab.items.length === 0 ? (
                    <div className="empty" data-testid="tab-items-empty">No items on the tab yet</div>
                  ) : selectedTab.items.map(item => {
                      const product = products.find(p => p.id === item.product_id);
                      const slug = product?.name.toLowerCase().replace(/\s+/g, '-') ?? String(item.id);
                      return (
                        <div className="list-item" key={item.id} style={{ gap: 10 }}>
                          <ProductThumb image={product?.image} name={product?.name} size={36} />
                          <div className="list-item__main">
                            <div className="list-item__name">{product?.name ?? `Product #${item.product_id}`}</div>
                            <div className="list-item__sub">@ ${item.unit_price.toFixed(2)} each</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              data-testid={`tab-item-decrease-${slug}`}
                              className="btn btn--sm btn--ghost"
                              onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                            >−</button>
                            <span key={`qty-${item.id}-${item.quantity}`} className="value-bump" data-testid={`tab-item-qty-${slug}`} style={{ fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                            <button
                              data-testid={`tab-item-increase-${slug}`}
                              className="btn btn--sm btn--ghost"
                              onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                            >+</button>
                            <span key={`sub-${item.id}-${item.subtotal}`} className="value-bump" style={{ fontWeight: 600, minWidth: 50, textAlign: 'right' }}>${item.subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                  })}
                </div>
              </div>

              <div className="card">
                <div className="card__title">Pay Tab</div>
                {selectedTab.items?.length === 0 ? (
                  <button
                    data-testid="void-tab-btn"
                    className="btn btn--danger"
                    onClick={() => setShowPinForVoid(true)}
                  >
                    Close Tab (no charge)
                  </button>
                ) : (
                  <>
                    {/* Discount bar — hidden for at_cost tabs */}
                    {selectedTab.at_cost ? (
                      <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef9c3', borderRadius: 6, padding: '6px 10px', marginBottom: 12 }}>
                        Staff price active — discounts unavailable
                      </div>
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        {tabEffectiveSavings > 0 && tabActiveDiscount ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>
                            <span>🏷 {tabActiveDiscount.discount.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>−${tabEffectiveSavings.toFixed(2)}</span>
                              <button
                                className="btn btn--sm btn--ghost"
                                style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                                onClick={() => setManualDiscountOverride(null)}
                                title="Remove discount"
                              >✕</button>
                            </div>
                          </div>
                        ) : null}
                        {manualDiscounts.length > 0 && (
                          <button
                            className="btn btn--sm btn--ghost"
                            style={{ fontSize: '0.8rem', marginBottom: 4 }}
                            onClick={() => {
                              if (manualDiscounts.some(d => d.requires_pin)) {
                                setShowCourtesyPin(true);
                              } else {
                                setShowManualPicker(true);
                              }
                            }}
                          >
                            🎁 Apply courtesy…
                          </button>
                        )}
                      </div>
                    )}

                    {tabEffectiveSavings > 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', marginBottom: 10 }}>
                        <span>Total</span>
                        <span>${tabEffectiveTotal.toFixed(2)}</span>
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        data-testid="pay-card-btn"
                        className="btn btn--primary"
                        style={{ flex: 1 }}
                        onClick={handlePayCard}
                      >
                        💳 Pay with Card
                      </button>
                      <button
                        data-testid="proceed-to-cash-btn"
                        className="btn btn--success"
                        style={{ flex: 1 }}
                        onClick={() => setPayStep('cash')}
                      >
                        💵 Pay with Cash
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="card">
                <ProductPicker
                  title="Add Items"
                  products={filteredAddProducts}
                  onAdd={handleAddProduct}
                  addTestIdPrefix="tab-add"
                  stockTestIdPrefix="tab-product-stock"
                  getPrice={p => selectedTab.at_cost ? p.cost : p.price}
                  getPriceNote={_p => selectedTab.at_cost
                    ? <span style={{ marginLeft: 4, fontSize: '0.75rem', color: '#92400e' }}>(cost)</span>
                    : null
                  }
                  viewMode={addViewMode}
                  onViewModeChange={setAddView}
                  showViewToggle
                  viewToggleTestIds={{ grid: 'tabs-add-grid-view-btn', list: 'tabs-add-list-view-btn' }}
                  gridTestId="tabs-add-products-grid"
                  listTestId="tabs-add-products-list"
                  search={addSearch}
                  onSearchChange={setAddSearch}
                  showSearch
                  soldCounts={soldCounts}
                  sortStorageKey="product-sort"
                  showActiveFilter
                  activeFilterStorageKey="product-active-filter"
                  showStockFilter
                  stockFilterStorageKey="product-stock-filter"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
