import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Product, Tab } from '../api/client';

export default function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState<{ name: string; delta: number; new_units: number }[]>([]);
  const [tabReserved, setTabReserved] = useState<Record<number, number>>({});

  useEffect(() => {
    async function load() {
      const [ps, tabs] = await Promise.all([api.getProducts(), api.getTabs()]);
      const eligible = ps.filter(p => !p.uses_supplies && p.active !== false && p.track_inventory !== false);
      setProducts(eligible);
      setCounts(Object.fromEntries(eligible.map(p => [p.id, String(p.units)])));
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
    load().catch(() => {});
  }, []);

  async function handleAdjust() {
    setError(''); setSuccess(''); setResult([]);
    const adjustments = products
      .filter(p => String(counts[p.id]) !== String(p.units))
      .map(p => ({ product_id: p.id, physical_count: Number(counts[p.id]) }));
    if (adjustments.length === 0) { setError('No changes detected'); return; }
    try {
      const res = await api.adjustInventory(adjustments);
      setSuccess('Inventory adjusted');
      setResult(res.adjustments);
      const updated = (await api.getProducts()).filter(p => !p.uses_supplies && p.active !== false);
      setProducts(updated);
      setCounts(Object.fromEntries(updated.map(p => [p.id, String(p.units)])));
    } catch (e: unknown) { setError((e as Error).message); }
  }

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      {result.length > 0 && (
        <div className="card" data-testid="adjustment-result">
          <div className="card__title">Adjustment Result</div>
          {result.map(r => (
            <div className="list-item" key={r.name}>
              <div className="list-item__name">{r.name}</div>
              <div style={{ color: r.delta < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {r.delta >= 0 ? '+' : ''}{r.delta} → {r.new_units} units
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" data-testid="inventory-form">
        <div className="card__title">Physical Count</div>
        {products.map(p => (
          <div className="list-item" key={p.id}>
            <div className="list-item__main">
              <div className="list-item__name">{p.name}</div>
              <div className="list-item__sub">System: {p.units} units</div>
              {tabReserved[p.id] > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--warning, #d97706)' }}>
                  {tabReserved[p.id]} in open tabs
                </div>
              )}
            </div>
            <input data-testid={`physical-count-${p.name.toLowerCase().replace(/\s+/g,'-')}`}
              className="input" type="number" min="0"
              style={{ width: 80 }}
              value={counts[p.id] ?? ''}
              onChange={e => setCounts(prev => ({ ...prev, [p.id]: e.target.value }))} />
          </div>
        ))}
        <button data-testid="submit-adjustment-btn" className="btn btn--primary" style={{ marginTop: 12 }}
          onClick={handleAdjust}>Apply Adjustment</button>
      </div>
    </div>
  );
}
