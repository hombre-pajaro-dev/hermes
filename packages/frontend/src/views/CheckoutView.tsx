import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Discount, Product, Supply } from '../api/client';
import { computeCartAwareProducts } from '../lib/cart-utils';
import ReceiptModal, { type ReceiptLine, type ReceiptDiscount } from '../components/ReceiptModal';
import ProductThumb from '../components/ProductThumb';
import ProductPicker from '../components/ProductPicker';
import PinModal from '../components/PinModal';
import { computeSavings, getBestAutoDiscount } from '../lib/discounts';
import type { CartItem } from '../lib/discounts';

type ViewMode = 'list' | 'grid';
type Step = 'order' | 'cash';

interface LineItem { product: Product; quantity: number; }

interface Receipt {
  timestamp: Date;
  lines: ReceiptLine[];
  subtotal: number;
  discountLine: ReceiptDiscount | null;
  total: number;
  changeDue: number | null;
}

export default function CheckoutView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [step, setStep] = useState<Step>('order');
  const [cashReceived, setCashReceived] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('checkout-view') as ViewMode | null) ?? 'grid';
  });
  const [search, setSearch] = useState('');
  const [soldCounts, setSoldCounts] = useState<Record<number, number>>({});

  // Discounts
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  // undefined = use auto, null = cashier explicitly removed, object = cashier explicitly chose
  const [manualDiscountOverride, setManualDiscountOverride] = useState<
    { discount: Discount; savings: number } | null | undefined
  >(undefined);
  const [showCourtesyPin, setShowCourtesyPin] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);

  function setView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('checkout-view', mode);
  }

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
    api.getSupplies().then(setSupplies).catch(() => {});
    api.getTopProducts().then(rows => {
      setSoldCounts(Object.fromEntries(rows.map(r => [r.product_id, r.units_sold])));
    }).catch(() => {});
    api.getDiscounts().then(setDiscounts).catch(() => {});
  }, []);

  function addProduct(product: Product) {
    setLines(prev => {
      const ex = prev.find(l => l.product.id === product.id);
      if (ex) return prev.map(l => l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: number, delta: number) {
    setLines(prev =>
      prev.map(l => l.product.id === productId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)
        .filter(l => l.quantity > 0)
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  // Cart-aware products: each product's `units` reflects remaining availability
  // after accounting for what the current cart already consumes from shared supplies.
  const cart = Object.fromEntries(lines.map(l => [l.product.id, l.quantity]));
  const cartAwareProducts = computeCartAwareProducts(products, supplies, cart);
  // Map for quick lookup (used to gate the + button in the order summary)
  const cartAwareUnits: Record<number, number> = Object.fromEntries(
    cartAwareProducts.map(p => [p.id, p.units])
  );

  const filteredProducts = search.trim()
    ? cartAwareProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : cartAwareProducts;

  // Compute cart items for discount engine
  const cartItems: CartItem[] = lines.map(l => ({
    product_id: l.product.id,
    price: l.product.price,
    quantity: l.quantity,
  }));

  // Auto-discount (best eligible non-manual discount)
  const autoDiscount = lines.length > 0 ? getBestAutoDiscount(discounts, cartItems) : null;

  // Active discount: manual override takes priority, else auto
  const rawActive = manualDiscountOverride !== undefined ? manualDiscountOverride : autoDiscount;
  // Re-compute savings live so the amount stays accurate as items change
  const activeDiscount = rawActive
    ? { discount: rawActive.discount, savings: computeSavings(rawActive.discount, cartItems) }
    : null;
  const effectiveSavings = activeDiscount && activeDiscount.savings > 0 ? activeDiscount.savings : 0;
  const effectiveTotal = Math.max(0, subtotal - effectiveSavings);

  const prevTotal = useRef<number | null>(null);
  const [totalBump, setTotalBump] = useState(0);
  useEffect(() => {
    if (prevTotal.current !== null && prevTotal.current !== subtotal) setTotalBump(b => b + 1);
    prevTotal.current = subtotal;
  }, [subtotal]);

  const cashNum = Number(cashReceived) || 0;
  const liveChange = cashReceived !== '' ? cashNum - effectiveTotal : null;

  const manualDiscounts = discounts.filter(d => d.is_manual && d.active);

  function toReceiptLines(items: LineItem[]): ReceiptLine[] {
    return items.map(l => ({ id: l.product.id, name: l.product.name, quantity: l.quantity, unitPrice: l.product.price }));
  }

  function resetOrder() {
    setLines([]);
    setManualDiscountOverride(undefined);
    setCashReceived('');
    setStep('order');
    setError('');
  }

  async function handlePayCard() {
    setError(''); setLoading(true);
    const snapshot = { lines: [...lines], subtotal, activeDiscount };
    try {
      const order = await api.createOrder(snapshot.lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })));
      await api.payOrder(order.id, 'card', undefined, snapshot.activeDiscount?.discount.id);
      const discountLine = snapshot.activeDiscount && snapshot.activeDiscount.savings > 0
        ? { name: snapshot.activeDiscount.discount.name, savings: snapshot.activeDiscount.savings }
        : null;
      setReceipt({
        timestamp: new Date(),
        lines: toReceiptLines(snapshot.lines),
        subtotal: snapshot.subtotal,
        discountLine,
        total: Math.max(0, snapshot.subtotal - (discountLine?.savings ?? 0)),
        changeDue: null,
      });
      resetOrder();
      const [updated, updatedSupplies, top, refreshedDiscounts] = await Promise.all([
        api.getProducts(), api.getSupplies(), api.getTopProducts(), api.getDiscounts(),
      ]);
      setProducts(updated);
      setSupplies(updatedSupplies);
      setSoldCounts(Object.fromEntries(top.map(r => [r.product_id, r.units_sold])));
      setDiscounts(refreshedDiscounts);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handlePayCash() {
    setError(''); setLoading(true);
    const snapshot = { lines: [...lines], subtotal, activeDiscount };
    try {
      const order = await api.createOrder(snapshot.lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })));
      const paid = await api.payOrder(order.id, 'cash', Number(cashReceived), snapshot.activeDiscount?.discount.id);
      const discountLine = snapshot.activeDiscount && snapshot.activeDiscount.savings > 0
        ? { name: snapshot.activeDiscount.discount.name, savings: snapshot.activeDiscount.savings }
        : null;
      const effectivePaid = Math.max(0, snapshot.subtotal - (discountLine?.savings ?? 0));
      setReceipt({
        timestamp: new Date(),
        lines: toReceiptLines(snapshot.lines),
        subtotal: snapshot.subtotal,
        discountLine,
        total: effectivePaid,
        changeDue: paid.change_due ?? null,
      });
      resetOrder();
      const [updated, updatedSupplies, top, refreshedDiscounts] = await Promise.all([
        api.getProducts(), api.getSupplies(), api.getTopProducts(), api.getDiscounts(),
      ]);
      setProducts(updated);
      setSupplies(updatedSupplies);
      setSoldCounts(Object.fromEntries(top.map(r => [r.product_id, r.units_sold])));
      setDiscounts(refreshedDiscounts);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function handleCloseReceipt() {
    setReceipt(null);
  }

  return (
    <div>
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
                  const savings = computeSavings(d, cartItems);
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

      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}

      {step === 'cash' ? (
        <div className="card" data-testid="cash-payment-view">
          <div className="card__title">Cash Payment</div>

          {lines.map(l => (
            <div className="list-item" key={l.product.id}>
              <div className="list-item__main">
                <div className="list-item__name">{l.product.name}</div>
                <div className="list-item__sub">${l.product.price.toFixed(2)} × {l.quantity}</div>
              </div>
              <div style={{ minWidth: 60, textAlign: 'right' }}>${(l.product.price * l.quantity).toFixed(2)}</div>
            </div>
          ))}

          {effectiveSavings > 0 && activeDiscount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, margin: '4px 0' }}>
              <span>🏷 {activeDiscount.discount.name}</span>
              <span>−${effectiveSavings.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', margin: '12px 0 16px' }}>
            <span>Total Due</span>
            <span>${effectiveTotal.toFixed(2)}</span>
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
                fontSize: '1.6rem', fontWeight: 700, textAlign: 'center', padding: '14px 0',
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
              onClick={() => { setStep('order'); setError(''); setCashReceived(''); }}
            >
              ← Back
            </button>
            <button
              data-testid="confirm-payment-btn"
              className="btn btn--success"
              style={{ flex: 1 }}
              onClick={handlePayCash}
              disabled={loading || !cashReceived || Number(cashReceived) < effectiveTotal}
            >
              {loading ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card" data-testid="order-lines">
            <div className="card__title">Order</div>
            <div style={{ height: '35vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {lines.length === 0 ? (
                <div className="empty" data-testid="order-empty">No items in the order yet</div>
              ) : (
                lines.map(l => (
                  <div className="list-item" key={l.product.id} style={{ gap: 10 }}>
                    <ProductThumb image={l.product.image} name={l.product.name} size={36} />
                    <div className="list-item__main">
                      <div className="list-item__name">{l.product.name}</div>
                      <div className="list-item__sub">${l.product.price.toFixed(2)} each</div>
                    </div>
                    <div className="qty">
                      <button className="btn btn--sm btn--ghost" onClick={() => changeQty(l.product.id, -1)}>−</button>
                      <span className="qty__val" data-testid={`qty-${l.product.name.toLowerCase()}`}>{l.quantity}</span>
                      <button
                        className="btn btn--sm btn--ghost"
                        onClick={() => changeQty(l.product.id, +1)}
                        disabled={(cartAwareUnits[l.product.id] ?? 0) <= 0}
                        title={(cartAwareUnits[l.product.id] ?? 0) <= 0 ? 'No more stock available' : undefined}
                      >+</button>
                    </div>
                    <div style={{ minWidth: 60, textAlign: 'right' }}>${(l.product.price * l.quantity).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Totals + discount */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
              {effectiveSavings > 0 && activeDiscount ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 4 }}>
                    <span>Subtotal</span>
                    <span key={totalBump} className="value-bump" data-testid="order-total">${subtotal.toFixed(2)}</span>
                  </div>
                  <div data-testid="discount-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                    <span>🏷 {activeDiscount.discount.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>−${effectiveSavings.toFixed(2)}</span>
                      <button
                        data-testid="remove-discount-btn"
                        className="btn btn--sm btn--ghost"
                        style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                        onClick={() => setManualDiscountOverride(null)}
                        title="Remove discount"
                      >✕</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 14 }}>
                    <span>Total</span>
                    <span>${effectiveTotal.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 14 }}>
                  <span>Total</span>
                  <span key={totalBump} className="value-bump" data-testid="order-total">${subtotal.toFixed(2)}</span>
                </div>
              )}

              {/* Courtesy discount button */}
              {lines.length > 0 && manualDiscounts.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <button
                    className="btn btn--sm btn--ghost"
                    style={{ fontSize: '0.8rem' }}
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
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                data-testid="pay-card-btn"
                className="btn btn--primary"
                style={{ flex: 1 }}
                onClick={handlePayCard}
                disabled={loading || lines.length === 0}
              >
                {loading ? 'Processing…' : '💳 Pay with Card'}
              </button>
              <button
                data-testid="proceed-to-cash-btn"
                className="btn btn--success"
                style={{ flex: 1 }}
                onClick={() => setStep('cash')}
                disabled={lines.length === 0}
              >
                💵 Pay with Cash
              </button>
            </div>
          </div>

          <div className="card">
            <ProductPicker
              title="Add Items"
              products={filteredProducts}
              onAdd={addProduct}
              viewMode={viewMode}
              onViewModeChange={setView}
              showViewToggle
              viewToggleTestIds={{ grid: 'checkout-grid-view-btn', list: 'checkout-list-view-btn' }}
              gridTestId="checkout-products-grid"
              listTestId="checkout-products-list"
              search={search}
              onSearchChange={setSearch}
              showSearch
              addTestIdPrefix="add"
              orderQty={id => lines.find(l => l.product.id === id)?.quantity}
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
  );
}
