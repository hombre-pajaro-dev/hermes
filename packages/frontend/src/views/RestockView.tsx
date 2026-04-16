import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Product, Supply } from '../api/client';

export default function RestockView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [productQtys, setProductQtys] = useState<Record<number, string>>({});
  const [supplyQtys, setSupplyQtys] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const [ps, ss] = await Promise.all([api.getProducts(), api.getSupplies()]);
    setProducts(ps);
    setSupplies(ss);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  const unitProducts = products.filter(p => !p.uses_supplies);

  async function handleRestock() {
    setError(''); setSuccess('');

    const productItems = Object.entries(productQtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => ({ product_id: Number(id), quantity: Number(q) }));

    const supplyItems = Object.entries(supplyQtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => ({ supply_id: Number(id), quantity: Number(q) }));

    if (productItems.length === 0 && supplyItems.length === 0) {
      setError('No quantities entered');
      return;
    }

    try {
      if (productItems.length > 0) {
        await api.restock(productItems);
      }
      for (const si of supplyItems) {
        await api.restockSupply(si.supply_id, si.quantity);
      }
      setSuccess('Restock completed');
      setProductQtys({});
      setSupplyQtys({});
      await load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}

      {unitProducts.length > 0 && (
        <div className="card" data-testid="restock-form">
          <div className="card__title">Products</div>
          {unitProducts.map(p => (
            <div className="list-item" key={p.id}>
              <div className="list-item__main">
                <div className="list-item__name">{p.name}</div>
                <div className="list-item__sub">Current: {p.units} units</div>
              </div>
              <input
                data-testid={`restock-qty-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="input" type="number" min="0" placeholder="0"
                style={{ width: 80 }}
                value={productQtys[p.id] ?? ''}
                onChange={e => setProductQtys(prev => ({ ...prev, [p.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {supplies.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card__title">Supplies</div>
          {supplies.map(s => (
            <div className="list-item" key={s.id}>
              <div className="list-item__main">
                <div className="list-item__name">{s.name}</div>
                <div className="list-item__sub">Current: {s.quantity} {s.unit}</div>
              </div>
              <input
                data-testid={`restock-supply-${s.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="input" type="number" min="0" placeholder="0"
                style={{ width: 80 }}
                value={supplyQtys[s.id] ?? ''}
                onChange={e => setSupplyQtys(prev => ({ ...prev, [s.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {unitProducts.length === 0 && supplies.length === 0 && (
        <div className="card">
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
