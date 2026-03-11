import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Product } from '../api/client';

export default function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState<{ name: string; delta: number; new_units: number }[]>([]);

  useEffect(() => {
    api.getProducts().then(ps => {
      setProducts(ps);
      setCounts(Object.fromEntries(ps.map(p => [p.id, String(p.units)])));
    }).catch(() => {});
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
      const updated = await api.getProducts();
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
