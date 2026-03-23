import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Product } from '../api/client';

type ViewMode = 'list' | 'grid';

interface LineItem { product: Product; quantity: number; }

export default function CheckoutView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'card'>('card');
  const [cashReceived, setCashReceived] = useState('');
  const [result, setResult] = useState<{ change_due?: number } | null>(null);
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
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l).filter(l => l.quantity > 0));
  }

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const prevTotal = useRef<number | null>(null);
  const [totalBump, setTotalBump] = useState(0);
  useEffect(() => {
    if (prevTotal.current !== null && prevTotal.current !== total) setTotalBump(b => b + 1);
    prevTotal.current = total;
  }, [total]);

  async function handleCreateOrder() {
    setError(''); setLoading(true);
    try {
      const order = await api.createOrder(lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })));
      setOrderId(order.id); setOrderTotal(order.total);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handlePay() {
    if (!orderId) return;
    setError(''); setLoading(true);
    try {
      const paid = await api.payOrder(orderId, payMethod === 'card' ? 'card' : 'cash', payMethod === 'cash' ? Number(cashReceived) : undefined);
      setResult(paid); setLines([]); setOrderId(null);
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  if (result) return (
    <div>
      <div className="success-banner" data-testid="payment-success">Payment complete!</div>
      {result.change_due != null && result.change_due > 0 && (
        <div className="card"><div className="card__title">Change Due</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }} data-testid="change-due">${result.change_due.toFixed(2)}</div>
        </div>
      )}
      <button className="btn btn--primary" onClick={() => setResult(null)}>New Order</button>
    </div>
  );

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}

      {!orderId && (
        <>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12 }}>
                <span>Total</span><span key={totalBump} className="value-bump" data-testid="order-total">${total.toFixed(2)}</span>
              </div>
              <button data-testid="create-order-btn" className="btn btn--primary" style={{ marginTop: 12 }}
                onClick={handleCreateOrder} disabled={loading}>
                {loading ? 'Creating…' : 'Proceed to Payment'}
              </button>
            </div>
          )}
        </>
      )}

      {orderId && (
        <div className="card" data-testid="payment-panel">
          <div className="card__title">Payment — Total: ${orderTotal.toFixed(2)}</div>
          <div className="tabs-nav">
            <button className={`tabs-nav__item${payMethod === 'card' ? ' active' : ''}`} data-testid="pay-card-tab"
              onClick={() => setPayMethod('card')}>Card</button>
            <button className={`tabs-nav__item${payMethod === 'cash' ? ' active' : ''}`} data-testid="pay-cash-tab"
              onClick={() => setPayMethod('cash')}>Cash</button>
          </div>
          {payMethod === 'cash' && (
            <div className="field">
              <label className="label">Amount Received ($)</label>
              <input data-testid="cash-received-input" className="input" type="number" min="0" step="0.01"
                value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
            </div>
          )}
          <button data-testid="confirm-payment-btn" className="btn btn--success"
            onClick={handlePay} disabled={loading || (payMethod === 'cash' && !cashReceived)}>
            {loading ? 'Processing…' : `Pay with ${payMethod === 'card' ? 'Card' : 'Cash'}`}
          </button>
        </div>
      )}
    </div>
  );
}
