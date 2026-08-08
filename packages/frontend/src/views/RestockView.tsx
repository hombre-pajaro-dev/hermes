import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Product, Provider, Supply, Tab } from '../api/client';
import { authClient } from '../lib/auth-client';

export default function RestockView() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [productQtys, setProductQtys] = useState<Record<number, string>>({});
  const [productTotals, setProductTotals] = useState<Record<number, string>>({});
  const [supplyQtys, setSupplyQtys] = useState<Record<number, string>>({});
  const [supplyTotals, setSupplyTotals] = useState<Record<number, string>>({});
  const [tabReserved, setTabReserved] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Provider combobox ─────────────────────────────────────────────────────────
  const [providerInput, setProviderInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);

  // ── Payment account ───────────────────────────────────────────────────────────
  const [paymentAccount, setPaymentAccount] = useState('cash');

  async function load() {
    const [ps, ss, pvs, tabs] = await Promise.all([api.getProducts(), api.getSupplies(), api.getProviders(), api.getTabs()]);
    setProducts(ps);
    setSupplies(ss);
    setProviders(pvs);
    const reserved: Record<number, number> = {};
    const openTabs = (tabs as Tab[]).filter(t => t.status === 'open');
    await Promise.all(openTabs.map(async t => {
      const detail = await api.getTab(t.id);
      for (const item of detail.items ?? []) {
        const { product_id, quantity } = item;
        reserved[product_id] = (reserved[product_id] ?? 0) + quantity;
      }
    }));
    setTabReserved(reserved);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unitProducts = products.filter(p => !p.uses_supplies && p.active !== false && p.track_inventory !== false);

  const filteredProviders = providers.filter(p =>
    p.name.toLowerCase().includes(providerInput.toLowerCase())
  );
  const exactMatch = providers.some(p => p.name.toLowerCase() === providerInput.toLowerCase());

  function selectProvider(p: Provider) {
    setSelectedProvider(p);
    setProviderInput(p.name);
    setShowProviderDropdown(false);
  }

  async function handleCreateProvider() {
    if (!providerInput.trim()) return;
    try {
      const p = await api.createProvider(providerInput.trim());
      setProviders(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
      selectProvider(p);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  // Auto-computed total: sum of per-product total_paid amounts
  const computedTotal = unitProducts.reduce((sum, p) => {
    return sum + (Number(productTotals[p.id]) || 0);
  }, 0);

  const computedSupplyTotal = supplies.reduce((sum, s) => sum + (Number(supplyTotals[s.id]) || 0), 0);

  async function handleRestock() {
    setError(''); setSuccess('');

    if (!selectedProvider) { setError('Select or create a provider'); return; }
    if (!paymentAccount) { setError('Select a payment account'); return; }

    const productItems = Object.entries(productQtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => {
        const qty = Number(q);
        const total = Number(productTotals[Number(id)]) || 0;
        const unit_cost = qty > 0 && total > 0 ? total / qty : (products.find(p => p.id === Number(id))?.cost ?? 0);
        return { product_id: Number(id), quantity: qty, unit_cost };
      });

    const supplyItems = Object.entries(supplyQtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => {
        const qty = Number(q);
        const total = Number(supplyTotals[Number(id)]) || 0;
        const unit_cost = qty > 0 && total > 0 ? total / qty : (supplies.find(s => s.id === Number(id))?.cost ?? 0);
        return { supply_id: Number(id), quantity: qty, unit_cost };
      });

    if (productItems.length === 0 && supplyItems.length === 0) {
      setError('No quantities entered');
      return;
    }

    try {
      await api.restock(productItems, supplyItems, {
        provider_id: selectedProvider.id,
        payment_account: paymentAccount,
      });
      setSuccess('Restock completed');
      setProductQtys({});
      setProductTotals({});
      setSupplyQtys({});
      setSupplyTotals({});
      setProviderInput('');
      setSelectedProvider(null);
      await load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  if (!isAdmin) {
    return (
      <div className="card">
        <div className="empty">Admin access required to perform restocks.</div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      {/* Provider & Payment */}
      <div className="card" data-testid="restock-payment-form">
        <div className="card__title">Purchase Details</div>

        {/* Provider combobox */}
        <div className="field" ref={providerRef} style={{ position: 'relative' }}>
          <label className="label">Provider</label>
          <input
            data-testid="provider-input"
            className="input"
            type="text"
            placeholder="Type to search or create provider…"
            value={providerInput}
            autoComplete="off"
            onChange={e => {
              setProviderInput(e.target.value);
              setSelectedProvider(null);
              setShowProviderDropdown(true);
            }}
            onFocus={() => setShowProviderDropdown(true)}
          />
          {selectedProvider && (
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 4 }} data-testid="provider-selected-label">
              ✓ {selectedProvider.name}
            </div>
          )}
          {showProviderDropdown && providerInput.trim() && (
            <div
              data-testid="provider-dropdown"
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'var(--surface, #fff)', border: '1px solid var(--border)',
                borderRadius: 6, zIndex: 20, maxHeight: 200, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {filteredProviders.map(p => (
                <div
                  key={p.id}
                  data-testid={`provider-option-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                  onMouseDown={() => selectProvider(p)}
                >
                  {p.name}
                </div>
              ))}
              {!exactMatch && (
                <div
                  data-testid="create-provider-option"
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontStyle: 'italic',
                    color: 'var(--primary, #2563eb)',
                    borderTop: filteredProviders.length > 0 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseDown={handleCreateProvider}
                >
                  Create "{providerInput.trim()}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment account */}
        <div className="field">
          <label className="label">Pay from Account</label>
          <select
            data-testid="restock-payment-account"
            className="input"
            value={paymentAccount}
            onChange={e => setPaymentAccount(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="digital">Digital</option>
          </select>
        </div>
      </div>

      {/* Products */}
      {unitProducts.length > 0 && (
        <div className="card" data-testid="restock-form" style={{ marginTop: 12 }}>
          <div className="card__title">Products</div>
          {unitProducts.map(p => {
            const qty = Number(productQtys[p.id]) || 0;
            const total = Number(productTotals[p.id]) || 0;
            const derivedUnitCost = qty > 0 && total > 0 ? total / qty : null;
            const costChanged = derivedUnitCost !== null && derivedUnitCost !== p.cost;
            const slug = p.name.toLowerCase().replace(/\s+/g, '-');
            return (
              <div key={p.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div className="list-item__name">{p.name}</div>
                    <div className="list-item__sub">Stock: {p.units} units · Cost: ${p.cost.toFixed(2)}</div>
                    {tabReserved[p.id] > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--warning, #d97706)' }}>
                        {tabReserved[p.id]} in open tabs
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Qty</label>
                      <input
                        data-testid={`restock-qty-${slug}`}
                        className="input" type="number" min="0" placeholder="0"
                        style={{ width: 72 }}
                        value={productQtys[p.id] ?? ''}
                        onChange={e => setProductQtys(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total paid ($)</label>
                      <input
                        data-testid={`restock-total-${slug}`}
                        className="input" type="number" min="0.01" step="0.01" placeholder="0.00"
                        style={{ width: 88, borderColor: costChanged ? 'var(--warning, #d97706)' : undefined }}
                        value={productTotals[p.id] ?? ''}
                        onChange={e => setProductTotals(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                {derivedUnitCost !== null && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Unit cost: ${derivedUnitCost.toFixed(2)}
                  </div>
                )}
                {costChanged && (
                  <div data-testid={`cost-change-warning-${slug}`}
                    style={{ fontSize: '0.75rem', color: 'var(--warning, #d97706)', marginTop: 2 }}>
                    ⚠ cost will update: ${p.cost.toFixed(2)} → ${derivedUnitCost!.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
          {/* Computed total */}
          {computedTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <span data-testid="restock-computed-total" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                ${computedTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Supplies */}
      {supplies.length > 0 && (
        <div className="card" data-testid="restock-supply-form" style={{ marginTop: 12 }}>
          <div className="card__title">Supplies</div>
          {supplies.map(s => {
            const qty = Number(supplyQtys[s.id]) || 0;
            const total = Number(supplyTotals[s.id]) || 0;
            const derivedUnitCost = qty > 0 && total > 0 ? total / qty : null;
            const costChanged = derivedUnitCost !== null && derivedUnitCost !== s.cost;
            const slug = s.name.toLowerCase().replace(/\s+/g, '-');
            return (
              <div key={s.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div className="list-item__name">{s.name}</div>
                    <div className="list-item__sub">Current: {s.quantity} {s.unit} · Cost: ${s.cost.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Qty</label>
                      <input
                        data-testid={`restock-supply-qty-${slug}`}
                        className="input" type="number" min="0" step="0.001" placeholder="0"
                        style={{ width: 72 }}
                        value={supplyQtys[s.id] ?? ''}
                        onChange={e => setSupplyQtys(prev => ({ ...prev, [s.id]: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total paid ($)</label>
                      <input
                        data-testid={`restock-supply-total-${slug}`}
                        className="input" type="number" min="0.01" step="0.01" placeholder="0.00"
                        style={{ width: 88, borderColor: costChanged ? 'var(--warning, #d97706)' : undefined }}
                        value={supplyTotals[s.id] ?? ''}
                        onChange={e => setSupplyTotals(prev => ({ ...prev, [s.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                {derivedUnitCost !== null && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Unit cost: ${derivedUnitCost.toFixed(2)}
                  </div>
                )}
                {costChanged && (
                  <div data-testid={`supply-cost-change-warning-${slug}`}
                    style={{ fontSize: '0.75rem', color: 'var(--warning, #d97706)', marginTop: 2 }}>
                    ⚠ cost will update: ${s.cost.toFixed(2)} → ${derivedUnitCost!.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
          {computedSupplyTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <span data-testid="restock-supply-computed-total" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                ${computedSupplyTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {unitProducts.length === 0 && supplies.length === 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="empty">No products or supplies to restock</div>
        </div>
      )}

      <button
        data-testid="submit-restock-btn"
        className="btn btn--primary"
        style={{ marginTop: 12 }}
        onClick={handleRestock}
      >
        Submit Restock
      </button>
    </div>
  );
}
