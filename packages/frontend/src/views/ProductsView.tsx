import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Product, Tab } from '../api/client';

type EditField = 'price' | 'cost';
type ViewMode = 'list' | 'grid';

export default function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', cost: '', price: '', units: '' });
  const [editingPrice, setEditingPrice] = useState<Record<number, string>>({});
  const [editingCost, setEditingCost] = useState<Record<number, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('products-view') as ViewMode | null) ?? 'grid';
  });

  function setView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('products-view', mode);
  }

  async function load() {
    try {
      const [ps, tabs] = await Promise.all([api.getProducts(), api.getTabs()]);
      setProducts(ps);
      const openTabs = (tabs as Tab[]).filter(t => t.status === 'open');
      const locked = new Set<number>();
      await Promise.all(openTabs.map(async t => {
        const detail = await api.getTab(t.id);
        for (const item of detail.items ?? []) {
          locked.add((item as { product_id: number }).product_id);
        }
      }));
      setLockedIds(locked);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setError('');
    try {
      await api.createProduct({ name: form.name, description: form.description, cost: Number(form.cost), price: Number(form.price), units: Number(form.units) });
      setForm({ name: '', description: '', cost: '', price: '', units: '' });
      setShowForm(false);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function startEdit(p: Product, field: EditField) {
    if (field === 'price') setEditingPrice(prev => ({ ...prev, [p.id]: String(p.price) }));
    else setEditingCost(prev => ({ ...prev, [p.id]: String(p.cost) }));
  }

  function cancelEdit(id: number, field: EditField) {
    if (field === 'price') setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n; });
    else setEditingCost(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveField(p: Product, field: EditField) {
    setError('');
    const raw = field === 'price' ? editingPrice[p.id] : editingCost[p.id];
    const newVal = Number(raw);
    if (!newVal || newVal <= 0) { setError(`${field.charAt(0).toUpperCase() + field.slice(1)} must be greater than 0`); return; }
    try {
      if (field === 'price') await api.updatePrice(p.id, newVal);
      else await api.updateCost(p.id, newVal);
      cancelEdit(p.id, field);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function renderEditableField(p: Product, field: EditField, value: number, locked: boolean) {
    const isEditing = field === 'price' ? p.id in editingPrice : p.id in editingCost;
    const editVal = field === 'price' ? editingPrice[p.id] : editingCost[p.id];
    const setEdit = (v: string) =>
      field === 'price'
        ? setEditingPrice(prev => ({ ...prev, [p.id]: v }))
        : setEditingCost(prev => ({ ...prev, [p.id]: v }));

    if (isEditing) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            data-testid={`${field}-input-${p.id}`}
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            style={{ width: 80 }}
            value={editVal}
            onChange={e => setEdit(e.target.value)}
          />
          <button data-testid={`save-${field}-${p.id}`} className="btn btn--sm btn--success" onClick={() => saveField(p, field)}>✓</button>
          <button data-testid={`cancel-${field}-${p.id}`} className="btn btn--sm btn--ghost" onClick={() => cancelEdit(p.id, field)}>✕</button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontWeight: field === 'price' ? 700 : 400 }} data-testid={`product-${field}`}>
          ${value.toFixed(2)}
        </span>
        {locked ? (
          <span data-testid={`${field}-locked-${p.id}`} title={`In an open tab — cannot edit ${field}`} style={{ fontSize: '0.9rem' }}>🔒</span>
        ) : (
          <button data-testid={`edit-${field}-${p.id}`} className="btn btn--sm btn--ghost"
            onClick={() => startEdit(p, field)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
            Edit
          </button>
        )}
      </div>
    );
  }

  if (loading) return <div className="spinner">⏳</div>;

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button data-testid="add-product-btn" className="btn btn--primary" style={{ flex: 1 }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Product'}
        </button>
        <div className="view-toggle">
          <button
            data-testid="grid-view-btn"
            className={`view-toggle__btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setView('grid')}
            title="Grid view"
          >⊞</button>
          <button
            data-testid="list-view-btn"
            className={`view-toggle__btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >☰</button>
        </div>
      </div>

      {showForm && (
        <div className="card" data-testid="product-form">
          <div className="card__title">New Product</div>
          {(['name', 'description', 'cost', 'price', 'units'] as const).map(f => (
            <div className="field" key={f}>
              <label className="label">{f.charAt(0).toUpperCase() + f.slice(1)}</label>
              <input data-testid={`product-${f}-input`} className="input"
                type={['cost', 'price', 'units'].includes(f) ? 'number' : 'text'}
                min={['cost', 'price'].includes(f) ? '0.01' : undefined}
                step={['cost', 'price'].includes(f) ? '0.01' : undefined}
                value={form[f]} onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))} />
            </div>
          ))}
          <button data-testid="create-product-btn" className="btn btn--success"
            onClick={handleCreate} disabled={!form.name || !form.cost || !form.price}>
            Create Product
          </button>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="products-grid" data-testid="products-grid">
          {products.length === 0 ? <div className="empty">No products yet</div> : products.map(p => {
            const locked = lockedIds.has(p.id);
            return (
              <div className="product-card" key={p.id} data-testid="product-item">
                <div className="product-card__name" data-testid="product-name">{p.name}</div>
                <div className="product-card__meta">Price</div>
                <div className="product-card__field">
                  {renderEditableField(p, 'price', p.price, locked)}
                </div>
                <div className="product-card__meta">Cost</div>
                <div className="product-card__field">
                  {renderEditableField(p, 'cost', p.cost, locked)}
                </div>
                <div className="product-card__meta" data-testid="product-units">{p.units} units</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" data-testid="products-list">
          {products.length === 0 ? <div className="empty">No products yet</div> : products.map(p => {
            const locked = lockedIds.has(p.id);
            return (
              <div className="list-item" key={p.id} data-testid="product-item">
                <div className="list-item__main">
                  <div className="list-item__name" data-testid="product-name">{p.name}</div>
                  <div className="list-item__sub" style={{ marginTop: 4 }}>
                    <span style={{ marginRight: 8 }}>Cost:</span>
                    {renderEditableField(p, 'cost', p.cost, locked)}
                  </div>
                </div>
                <div className="list-item__right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Price</div>
                  {renderEditableField(p, 'price', p.price, locked)}
                  <div className="list-item__sub" data-testid="product-units">{p.units} units</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
