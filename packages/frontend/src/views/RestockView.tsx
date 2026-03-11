import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Product } from '../api/client';

export default function RestockView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [qtys, setQtys] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { api.getProducts().then(setProducts).catch(() => {}); }, []);

  async function handleRestock() {
    setError(''); setSuccess('');
    const items = Object.entries(qtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => ({ product_id: Number(id), quantity: Number(q) }));
    if (items.length === 0) { setError('No quantities entered'); return; }
    try {
      await api.restock(items);
      setSuccess('Restock completed'); setQtys({});
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}
      {success && <div className="success-banner" data-testid="success-banner">{success}</div>}
      <div className="card" data-testid="restock-form">
        <div className="card__title">Enter Quantities to Restock</div>
        {products.map(p => (
          <div className="list-item" key={p.id}>
            <div className="list-item__main">
              <div className="list-item__name">{p.name}</div>
              <div className="list-item__sub">Current: {p.units} units</div>
            </div>
            <input data-testid={`restock-qty-${p.name.toLowerCase().replace(/\s+/g,'-')}`}
              className="input" type="number" min="0" placeholder="0"
              style={{ width: 80 }}
              value={qtys[p.id] ?? ''}
              onChange={e => setQtys(prev => ({ ...prev, [p.id]: e.target.value }))} />
          </div>
        ))}
        <button data-testid="submit-restock-btn" className="btn btn--primary" style={{ marginTop: 12 }}
          onClick={handleRestock}>Submit Restock</button>
      </div>
    </div>
  );
}
