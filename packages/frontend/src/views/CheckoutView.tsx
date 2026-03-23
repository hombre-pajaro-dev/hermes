import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Product } from '../api/client';

type ViewMode = 'list' | 'grid';
type Step = 'order' | 'cash';

interface LineItem { product: Product; quantity: number; }

interface ReceiptData {
  timestamp: Date;
  lines: LineItem[];
  total: number;
  changeDue: number | null;
  payMethod: 'card' | 'cash';
}

export default function CheckoutView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [step, setStep] = useState<Step>('order');
  const [cashReceived, setCashReceived] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('checkout-view') as ViewMode | null) ?? 'grid';
  });
  const [search, setSearch] = useState('');

  function setView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('checkout-view', mode);
  }

  useEffect(() => { api.getProducts().then(setProducts).catch(() => {}); }, []);

  const filteredProducts = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

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

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const prevTotal = useRef<number | null>(null);
  const [totalBump, setTotalBump] = useState(0);
  useEffect(() => {
    if (prevTotal.current !== null && prevTotal.current !== total) setTotalBump(b => b + 1);
    prevTotal.current = total;
  }, [total]);

  const cashNum = Number(cashReceived) || 0;
  const liveChange = cashReceived !== '' ? cashNum - total : null;

  async function handlePayCard() {
    setError(''); setLoading(true);
    const snapshot = { lines: [...lines], total };
    try {
      const order = await api.createOrder(snapshot.lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })));
      await api.payOrder(order.id, 'card');
      setReceipt({ timestamp: new Date(), lines: snapshot.lines, total: snapshot.total, changeDue: null, payMethod: 'card' });
      setLines([]);
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handlePayCash() {
    setError(''); setLoading(true);
    const snapshot = { lines: [...lines], total };
    try {
      const order = await api.createOrder(snapshot.lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })));
      const paid = await api.payOrder(order.id, 'cash', Number(cashReceived));
      setReceipt({ timestamp: new Date(), lines: snapshot.lines, total: snapshot.total, changeDue: paid.change_due ?? null, payMethod: 'cash' });
      setLines([]);
      setCashReceived('');
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function handleCloseReceipt() {
    setReceipt(null);
    setStep('order');
    setError('');
  }

  return (
    <div>
      {/* Receipt Modal */}
      {receipt && (
        <div className="modal-overlay" data-testid="receipt-modal">
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="card__title" style={{ marginBottom: 4 }}>Receipt</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} data-testid="receipt-timestamp">
                  {receipt.timestamp.toLocaleString()}
                </div>
              </div>
              <span className="badge badge--open" data-testid="payment-success">Paid</span>
            </div>

            <div data-testid="receipt-items">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 12px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 6 }}>
                <span>Item</span><span>Qty</span><span>Unit</span><span>Total</span>
              </div>
              {receipt.lines.map(l => (
                <div key={l.product.id} data-testid={`receipt-item-${l.product.id}`}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 12px', fontSize: '0.9rem', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 500 }}>{l.product.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{l.quantity}</span>
                  <span>${l.product.price.toFixed(2)}</span>
                  <span style={{ fontWeight: 600 }}>${(l.product.price * l.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>Subtotal</span><span>${receipt.total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem' }}>
                <span>Total</span><span>${receipt.total.toFixed(2)}</span>
              </div>
              {receipt.changeDue !== null && receipt.changeDue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 600, marginTop: 10, fontSize: '1.1rem' }} data-testid="change-due">
                  <span>Change Due</span><span>${receipt.changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn btn--ghost btn--sm" data-testid="print-receipt-btn" onClick={() => {}}>🖨 Print</button>
              <button className="btn btn--ghost btn--sm" data-testid="email-receipt-btn" onClick={() => {}}>✉ Email</button>
              <button className="btn btn--primary" data-testid="close-receipt-btn" style={{ marginLeft: 'auto', width: 'auto', padding: '10px 20px' }} onClick={handleCloseReceipt}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}

      {step === 'cash' ? (
        /* Cash Payment View */
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

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', margin: '12px 0 16px' }}>
            <span>Total Due</span>
            <span>${total.toFixed(2)}</span>
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
              onClick={() => { setStep('order'); setError(''); setCashReceived(''); }}
            >
              ← Back
            </button>
            <button
              data-testid="confirm-payment-btn"
              className="btn btn--success"
              style={{ flex: 1 }}
              onClick={handlePayCash}
              disabled={loading || !cashReceived || Number(cashReceived) < total}
            >
              {loading ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Order Summary */}
          {lines.length > 0 && (
            <div className="card" data-testid="order-lines">
              <div className="card__title">Order</div>
              {lines.map(l => (
                <div className="list-item" key={l.product.id}>
                  <div className="list-item__main">
                    <div className="list-item__name">{l.product.name}</div>
                    <div className="list-item__sub">${l.product.price.toFixed(2)} each</div>
                  </div>
                  <div className="qty">
                    <button className="btn btn--sm btn--ghost" onClick={() => changeQty(l.product.id, -1)}>−</button>
                    <span className="qty__val" data-testid={`qty-${l.product.name.toLowerCase()}`}>{l.quantity}</span>
                    <button className="btn btn--sm btn--ghost" onClick={() => changeQty(l.product.id, +1)}>+</button>
                  </div>
                  <div style={{ minWidth: 60, textAlign: 'right' }}>${(l.product.price * l.quantity).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12, marginBottom: 14 }}>
                <span>Total</span>
                <span key={totalBump} className="value-bump" data-testid="order-total">${total.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  data-testid="pay-card-btn"
                  className="btn btn--primary"
                  style={{ flex: 1 }}
                  onClick={handlePayCard}
                  disabled={loading}
                >
                  {loading ? 'Processing…' : '💳 Pay with Card'}
                </button>
                <button
                  data-testid="proceed-to-cash-btn"
                  className="btn btn--success"
                  style={{ flex: 1 }}
                  onClick={() => setStep('cash')}
                >
                  💵 Pay with Cash
                </button>
              </div>
            </div>
          )}

          {/* Add Items */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div className="card__title" style={{ flex: 1, marginBottom: 0 }}>Add Items</div>
              <div className="view-toggle">
                <button
                  data-testid="checkout-grid-view-btn"
                  className={`view-toggle__btn${viewMode === 'grid' ? ' active' : ''}`}
                  onClick={() => setView('grid')}
                  title="Grid view"
                >⊞</button>
                <button
                  data-testid="checkout-list-view-btn"
                  className={`view-toggle__btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setView('list')}
                  title="List view"
                >☰</button>
              </div>
            </div>

            <input
              data-testid="product-search"
              className="input"
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            {viewMode === 'grid' ? (
              <div className="products-grid" data-testid="checkout-products-grid">
                {filteredProducts.map(p => {
                  const inOrder = lines.find(l => l.product.id === p.id);
                  return (
                    <button
                      key={p.id}
                      data-testid={`add-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="product-card"
                      style={{ border: inOrder ? '2px solid var(--primary)' : undefined, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                      onClick={() => addProduct(p)}
                      disabled={p.units <= 0}
                    >
                      <div className="product-card__name">{p.name}</div>
                      <div className="product-card__price">${p.price.toFixed(2)}</div>
                      <div className="product-card__meta">{p.units > 0 ? `${p.units} in stock` : 'Out of stock'}</div>
                      {inOrder && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>× {inOrder.quantity} in order</div>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="checkout-products-list">
                {filteredProducts.map(p => (
                  <div className="list-item" key={p.id}>
                    <div className="list-item__main">
                      <div className="list-item__name">{p.name}</div>
                      <div className="list-item__sub">{p.units} in stock</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>${p.price.toFixed(2)}</span>
                      <button data-testid={`add-${p.name.toLowerCase().replace(/\s+/g, '-')}`} className="btn btn--sm btn--primary" onClick={() => addProduct(p)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
