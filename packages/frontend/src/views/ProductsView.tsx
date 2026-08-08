import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Product, Supply, Tab, Provider } from '../api/client';
import ImagePicker from '../components/ImagePicker';
import { authClient } from '../lib/auth-client';

type EditField = 'price' | 'cost' | 'staff_price';
type ViewMode = 'list' | 'grid';

interface SupplyIngredientDraft {
  supply_id: number;
  quantity_per_unit: string;
}

export default function ProductsView() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
  const [tabReserved, setTabReserved] = useState<Record<number, number>>({});
  const [editingProviderIds, setEditingProviderIds] = useState<Set<number>>(new Set());
  const [providerDrafts, setProviderDrafts] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Create form state
  const [form, setForm] = useState({ name: '', description: '', cost: '', price: '', units: '' });
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formUsesSupplies, setFormUsesSupplies] = useState(false);
  const [formSupplyIngredients, setFormSupplyIngredients] = useState<SupplyIngredientDraft[]>([]);

  const [editingPrice, setEditingPrice] = useState<Record<number, string>>({});
  const [editingCost, setEditingCost] = useState<Record<number, string>>({});
  const [editingStaffPrice, setEditingStaffPrice] = useState<Record<number, string>>({});

  // Supply ingredient editing per product
  const [editingSupplyIds, setEditingSupplyIds] = useState<Set<number>>(new Set());
  const [supplyDrafts, setSupplyDrafts] = useState<Record<number, SupplyIngredientDraft[]>>({});

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('products-view') as ViewMode | null) ?? 'grid';
  });
  const [search, setSearch] = useState('');

  function setView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('products-view', mode);
  }

  const filteredProducts = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  async function load() {
    try {
      const [ps, tabs, ss, provs] = await Promise.all([api.getProducts(), api.getTabs(), api.getSupplies(), api.getProviders()]);
      setProviders(provs);
      setProducts(ps);
      setSupplies(ss);

      const openTabs = (tabs as Tab[]).filter(t => t.status === 'open');
      const locked = new Set<number>();
      const reserved: Record<number, number> = {};
      await Promise.all(openTabs.map(async t => {
        const detail = await api.getTab(t.id);
        for (const item of detail.items ?? []) {
          const { product_id, quantity } = item;
          locked.add(product_id);
          reserved[product_id] = (reserved[product_id] ?? 0) + quantity;
        }
      }));
      setLockedIds(locked);
      setTabReserved(reserved);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setError('');
    try {
      const supply_ingredients = formUsesSupplies
        ? formSupplyIngredients
            .filter(si => si.supply_id > 0 && Number(si.quantity_per_unit) > 0)
            .map(si => ({ supply_id: si.supply_id, quantity_per_unit: Number(si.quantity_per_unit) }))
        : undefined;

      await api.createProduct({
        name: form.name,
        description: form.description,
        cost: Number(form.cost),
        price: Number(form.price),
        units: formUsesSupplies ? 0 : Number(form.units),
        image: formImage,
        active: true,
        track_inventory: true,
        supply_ingredients,
      });
      setForm({ name: '', description: '', cost: '', price: '', units: '' });
      setFormImage(null);
      setFormUsesSupplies(false);
      setFormSupplyIngredients([]);
      setShowForm(false);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleImageChange(productId: number, dataUrl: string) {
    setError('');
    try {
      const updated = await api.updateImage(productId, dataUrl);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image: updated.image } : p));
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function startEdit(p: Product, field: EditField) {
    if (field === 'price') setEditingPrice(prev => ({ ...prev, [p.id]: String(p.price) }));
    else if (field === 'cost') setEditingCost(prev => ({ ...prev, [p.id]: String(p.cost) }));
    else setEditingStaffPrice(prev => ({ ...prev, [p.id]: String(p.staff_price) }));
  }

  function cancelEdit(id: number, field: EditField) {
    if (field === 'price') setEditingPrice(prev => { const n = { ...prev }; delete n[id]; return n; });
    else if (field === 'cost') setEditingCost(prev => { const n = { ...prev }; delete n[id]; return n; });
    else setEditingStaffPrice(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function handleToggleActive(p: Product) {
    setError('');
    try {
      const updated = await api.setProductActive(p.id, !p.active);
      setProducts(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleToggleTrackInventory(p: Product) {
    setError('');
    try {
      const updated = await api.setProductTrackInventory(p.id, !p.track_inventory);
      setProducts(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function saveField(p: Product, field: EditField) {
    setError('');
    const raw = field === 'price' ? editingPrice[p.id] : field === 'cost' ? editingCost[p.id] : editingStaffPrice[p.id];
    const newVal = Number(raw);
    if (!newVal || newVal <= 0) { setError(`${field === 'staff_price' ? 'Staff price' : field.charAt(0).toUpperCase() + field.slice(1)} must be greater than 0`); return; }
    try {
      if (field === 'price') await api.updatePrice(p.id, newVal);
      else if (field === 'cost') await api.updateCost(p.id, newVal);
      else await api.updateStaffPrice(p.id, newVal);
      cancelEdit(p.id, field);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function openSupplyEdit(p: Product) {
    setSupplyDrafts(prev => ({
      ...prev,
      [p.id]: p.supply_ingredients.map(si => ({
        supply_id: si.supply_id,
        quantity_per_unit: String(si.quantity_per_unit),
      })),
    }));
    setEditingSupplyIds(prev => new Set([...prev, p.id]));
  }

  function cancelSupplyEdit(id: number) {
    setEditingSupplyIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setSupplyDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveSupplyEdit(id: number) {
    setError('');
    const drafts = supplyDrafts[id] ?? [];
    const supply_ingredients = drafts
      .filter(d => d.supply_id > 0 && Number(d.quantity_per_unit) > 0)
      .map(d => ({ supply_id: d.supply_id, quantity_per_unit: Number(d.quantity_per_unit) }));
    try {
      await api.setProductSupplies(id, supply_ingredients);
      cancelSupplyEdit(id);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function openProviderEdit(p: Product) {
    setProviderDrafts(prev => ({ ...prev, [p.id]: p.provider_id ?? null }));
    setEditingProviderIds(prev => new Set([...prev, p.id]));
  }

  function cancelProviderEdit(id: number) {
    setEditingProviderIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setProviderDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveProviderEdit(id: number) {
    setError('');
    try {
      await api.setProductProvider(id, providerDrafts[id] ?? null);
      cancelProviderEdit(id);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  function renderProviderSection(p: Product) {
    if (!isAdmin || p.uses_supplies) return null;
    if (p.track_inventory !== false) return null;

    const isEditing = editingProviderIds.has(p.id);

    if (!isEditing) {
      return (
        <div style={{ marginTop: 6 }}>
          {p.provider_name && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Provider: <strong>{p.provider_name}</strong>
            </div>
          )}
          <button
            data-testid={`edit-provider-${p.id}`}
            className="btn btn--sm btn--ghost"
            style={{ fontSize: '0.72rem', marginTop: 4 }}
            onClick={() => openProviderEdit(p)}
          >
            {p.provider_name ? 'Change Provider' : 'Link Provider'}
          </button>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 6, padding: '8px', background: 'var(--surface-raised, #f5f5f5)', borderRadius: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Provider</div>
        <select
          data-testid={`provider-select-${p.id}`}
          className="input"
          value={providerDrafts[p.id] ?? ''}
          onChange={e => setProviderDrafts(prev => ({ ...prev, [p.id]: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">— no provider —</option>
          {providers.map(prov => (
            <option key={prov.id} value={prov.id}>{prov.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="btn btn--sm btn--ghost" style={{ flex: 1 }} onClick={() => cancelProviderEdit(p.id)}>Cancel</button>
          <button data-testid={`save-provider-${p.id}`} className="btn btn--sm btn--success" style={{ flex: 1 }} onClick={() => saveProviderEdit(p.id)}>Save</button>
        </div>
      </div>
    );
  }

  function addSupplyIngredientDraft(drafts: SupplyIngredientDraft[], setter: (d: SupplyIngredientDraft[]) => void) {
    setter([...drafts, { supply_id: 0, quantity_per_unit: '' }]);
  }

  function renderSupplyIngredients(
    drafts: SupplyIngredientDraft[],
    setDrafts: (d: SupplyIngredientDraft[]) => void,
  ) {
    return (
      <div>
        {drafts.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <select
              className="input"
              style={{ flex: 2 }}
              value={d.supply_id}
              onChange={e => {
                const updated = [...drafts];
                updated[i] = { ...updated[i], supply_id: Number(e.target.value) };
                setDrafts(updated);
              }}
            >
              <option value={0}>— select supply —</option>
              {supplies.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="qty / unit"
              style={{ flex: 1, minWidth: 80 }}
              value={d.quantity_per_unit}
              onChange={e => {
                const updated = [...drafts];
                updated[i] = { ...updated[i], quantity_per_unit: e.target.value };
                setDrafts(updated);
              }}
            />
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
            >✕</button>
          </div>
        ))}
        <button
          className="btn btn--sm btn--ghost"
          style={{ fontSize: '0.8rem', marginTop: 4 }}
          onClick={() => addSupplyIngredientDraft(drafts, setDrafts)}
        >
          + Add ingredient
        </button>
      </div>
    );
  }

  function markupLabel(value: number, cost: number) {
    if (cost <= 0) return null;
    const pct = Math.round(((value - cost) / cost) * 100);
    const color = pct > 0 ? 'var(--success)' : pct < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return <span style={{ fontSize: '0.72rem', color, marginLeft: 4 }}>{pct >= 0 ? '+' : ''}{pct}%</span>;
  }

  function renderEditableField(p: Product, field: EditField, value: number, locked: boolean) {
    if (field === 'cost' && p.uses_supplies) {
      return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span data-testid={`product-${field}`}>${value.toFixed(2)}</span>
          <span data-testid={`cost-computed-badge-${p.id}`} title="Computed from supply ingredients"
            style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            Σ computed
          </span>
        </div>
      );
    }
    if (!isAdmin) {
      return (
        <span style={{ fontWeight: field === 'price' ? 700 : 400 }} data-testid={`product-${field}`}>
          ${value.toFixed(2)}
        </span>
      );
    }

    const isEditing = field === 'price' ? p.id in editingPrice : field === 'cost' ? p.id in editingCost : p.id in editingStaffPrice;
    const editVal = field === 'price' ? editingPrice[p.id] : field === 'cost' ? editingCost[p.id] : editingStaffPrice[p.id];
    const setEdit = (v: string) =>
      field === 'price'
        ? setEditingPrice(prev => ({ ...prev, [p.id]: v }))
        : field === 'cost'
          ? setEditingCost(prev => ({ ...prev, [p.id]: v }))
          : setEditingStaffPrice(prev => ({ ...prev, [p.id]: v }));

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
        {field === 'price' && markupLabel(p.price, p.cost)}
        {field === 'staff_price' && markupLabel(p.staff_price, p.cost)}
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

  function renderSupplySection(p: Product) {
    if (!isAdmin) {
      return p.uses_supplies ? (
        <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {p.supply_ingredients.map(si => (
            <span key={si.supply_id} style={{ marginRight: 8 }}>
              {si.quantity_per_unit}{si.unit} {si.supply_name}
            </span>
          ))}
        </div>
      ) : null;
    }

    const isEditing = editingSupplyIds.has(p.id);
    const drafts = supplyDrafts[p.id] ?? [];

    if (!isEditing) {
      return (
        <div style={{ marginTop: 6 }}>
          {p.uses_supplies ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {p.supply_ingredients.map(si => (
                <span key={si.supply_id} style={{ marginRight: 8 }}>
                  {si.quantity_per_unit}{si.unit} {si.supply_name}
                </span>
              ))}
            </div>
          ) : null}
          <button
            className="btn btn--sm btn--ghost"
            style={{ fontSize: '0.72rem', marginTop: 4 }}
            onClick={() => openSupplyEdit(p)}
          >
            {p.uses_supplies ? 'Edit Supplies' : 'Link Supplies'}
          </button>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 6, padding: '8px', background: 'var(--surface-raised, #f5f5f5)', borderRadius: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Supply Ingredients</div>
        {renderSupplyIngredients(drafts, d => setSupplyDrafts(prev => ({ ...prev, [p.id]: d })))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="btn btn--sm btn--ghost" style={{ flex: 1 }} onClick={() => cancelSupplyEdit(p.id)}>Cancel</button>
          <button className="btn btn--sm btn--success" style={{ flex: 1 }} onClick={() => saveSupplyEdit(p.id)}>Save</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="spinner">⏳</div>;

  return (
    <div>
      {error && <div className="error-banner" data-testid="error-banner">{error}</div>}

      {isAdmin && (
        <button data-testid="add-product-btn" className="btn btn--primary"
          style={{ marginBottom: 8 }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Product'}
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <input
          data-testid="product-search"
          className="input"
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 120, marginBottom: 0 }}
        />
        <div className="view-toggle" style={{ flexShrink: 0 }}>
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

      {isAdmin && showForm && (
        <div className="card" data-testid="product-form">
          <div className="card__title">New Product</div>

          <div className="field" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <label className="label">Photo</label>
            <ImagePicker
              image={formImage}
              testId="product-thumbnail-new"
              size={96}
              onChange={setFormImage}
            />
            {formImage && (
              <button
                className="btn btn--sm btn--ghost"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setFormImage(null)}
              >
                Remove photo
              </button>
            )}
          </div>

          {(['name', 'description', 'cost', 'price'] as const).map(f => (
            <div className="field" key={f}>
              <label className="label">{f.charAt(0).toUpperCase() + f.slice(1)}</label>
              <input data-testid={`product-${f}-input`} className="input"
                type={['cost', 'price'].includes(f) ? 'number' : 'text'}
                min={['cost', 'price'].includes(f) ? '0.01' : undefined}
                step={['cost', 'price'].includes(f) ? '0.01' : undefined}
                value={form[f]} onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))} />
            </div>
          ))}

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formUsesSupplies}
                onChange={e => {
                  setFormUsesSupplies(e.target.checked);
                  if (!e.target.checked) setFormSupplyIngredients([]);
                }}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span className="label" style={{ margin: 0 }}>Uses supplies (stock computed from ingredients)</span>
            </label>
          </div>

          {!formUsesSupplies && (
            <div className="field">
              <label className="label">Units</label>
              <input data-testid="product-units-input" className="input"
                type="number" min="0"
                value={form.units} onChange={e => setForm(prev => ({ ...prev, units: e.target.value }))} />
            </div>
          )}

          {formUsesSupplies && (
            <div className="field">
              <label className="label">Supply ingredients</label>
              {supplies.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  No supplies defined yet — create them in Admin first.
                </p>
              ) : (
                renderSupplyIngredients(
                  formSupplyIngredients,
                  setFormSupplyIngredients,
                )
              )}
            </div>
          )}

          <button data-testid="create-product-btn" className="btn btn--success"
            onClick={handleCreate} disabled={!form.name || !form.cost || !form.price}>
            Create Product
          </button>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="products-grid" data-testid="products-grid">
          {filteredProducts.length === 0 ? <div className="empty">No products yet</div> : filteredProducts.map(p => {
            const locked = lockedIds.has(p.id);
            return (
              <div className="product-card" key={p.id} data-testid="product-item" style={{ opacity: p.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  {isAdmin ? (
                    <ImagePicker image={p.image} testId={`product-thumbnail-${p.id}`} size={96}
                      onChange={dataUrl => handleImageChange(p.id, dataUrl)} />
                  ) : p.image ? (
                    <img data-testid={`product-thumbnail-${p.id}`} src={p.image} alt="Product"
                      style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <div data-testid={`product-thumbnail-${p.id}`}
                      style={{ width: 96, height: 96, borderRadius: 8, background: '#f3f4f6', border: '2px dashed #d1d5db' }} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div className="product-card__name" data-testid="product-name" style={{ flex: 1 }}>{p.name}</div>
                  {!p.active && <span className="badge badge--void" style={{ fontSize: '0.65rem' }}>INACTIVE</span>}
                  {p.uses_supplies && <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>SUPPLY</span>}
                  {p.track_inventory === false && <span className="badge badge--void" style={{ fontSize: '0.65rem' }}>NO TRACK</span>}
                </div>
                <div className="product-card__meta">Price</div>
                <div className="product-card__field">
                  {renderEditableField(p, 'price', p.price, locked)}
                </div>
                <div className="product-card__meta">Cost</div>
                <div className="product-card__field">
                  {renderEditableField(p, 'cost', p.cost, locked)}
                </div>
                {isAdmin && (
                  <>
                    <div className="product-card__meta">Staff Price</div>
                    <div className="product-card__field">
                      {renderEditableField(p, 'staff_price', p.staff_price, false)}
                    </div>
                  </>
                )}
                <div className="product-card__meta" data-testid="product-units">{p.track_inventory === false ? '∞' : p.units} units</div>
                {tabReserved[p.id] > 0 && (
                  <div data-testid={`tab-reserved-${p.id}`}
                    style={{ fontSize: '0.72rem', color: 'var(--warning, #d97706)', marginTop: 2 }}>
                    {tabReserved[p.id]} in open tabs
                  </div>
                )}
                {renderSupplySection(p)}
                {renderProviderSection(p)}
                {isAdmin && (
                  <>
                    <button
                      data-testid={`toggle-active-${p.id}`}
                      className={`btn btn--sm ${p.active ? 'btn--ghost' : 'btn--success'}`}
                      style={{ marginTop: 8, width: '100%', fontSize: '0.75rem' }}
                      onClick={() => handleToggleActive(p)}
                    >
                      {p.active ? 'Deactivate' : 'Activate'}
                    </button>
                    {!p.uses_supplies && (
                      <button
                        data-testid={`toggle-track-inventory-${p.id}`}
                        className={`btn btn--sm ${p.track_inventory === false ? 'btn--primary' : 'btn--ghost'}`}
                        style={{ marginTop: 4, width: '100%', fontSize: '0.75rem' }}
                        onClick={() => handleToggleTrackInventory(p)}
                      >
                        {p.track_inventory === false ? 'Enable tracking' : 'Disable tracking'}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" data-testid="products-list">
          {filteredProducts.length === 0 ? <div className="empty">No products yet</div> : filteredProducts.map(p => {
            const locked = lockedIds.has(p.id);
            return (
              <div key={p.id} data-testid="product-item" style={{ gap: 12, opacity: p.active ? 1 : 0.55, minWidth: 0 }}>
                <div className="list-item" style={{ gap: 12, minWidth: 0 }}>
                  {isAdmin ? (
                    <ImagePicker image={p.image} testId={`product-thumbnail-${p.id}`} size={56}
                      onChange={dataUrl => handleImageChange(p.id, dataUrl)} />
                  ) : p.image ? (
                    <img data-testid={`product-thumbnail-${p.id}`} src={p.image} alt="Product"
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <div data-testid={`product-thumbnail-${p.id}`}
                      style={{ width: 56, height: 56, borderRadius: 8, background: '#f3f4f6', border: '2px dashed #d1d5db', flexShrink: 0 }} />
                  )}
                  <div className="list-item__main" style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="list-item__name" data-testid="product-name">{p.name}</div>
                      {!p.active && <span className="badge badge--void" style={{ fontSize: '0.65rem' }}>INACTIVE</span>}
                      {p.uses_supplies && <span className="badge badge--pending" style={{ fontSize: '0.65rem' }}>SUPPLY</span>}
                      {p.track_inventory === false && <span className="badge badge--void" style={{ fontSize: '0.65rem' }}>NO TRACK</span>}
                    </div>
                    <div className="list-item__sub" style={{ marginTop: 4 }}>
                      <span style={{ marginRight: 8 }}>Cost:</span>
                      {renderEditableField(p, 'cost', p.cost, locked)}
                    </div>
                    {isAdmin && (
                      <div className="list-item__sub" style={{ marginTop: 4 }}>
                        <span style={{ marginRight: 8 }}>Staff:</span>
                        {renderEditableField(p, 'staff_price', p.staff_price, false)}
                      </div>
                    )}
                  </div>
                  <div className="list-item__right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Price</div>
                    {renderEditableField(p, 'price', p.price, locked)}
                    <div className="list-item__sub" data-testid="product-units">{p.track_inventory === false ? '∞' : p.units} units</div>
                    {tabReserved[p.id] > 0 && (
                      <div data-testid={`tab-reserved-${p.id}`}
                        style={{ fontSize: '0.72rem', color: 'var(--warning, #d97706)' }}>
                        {tabReserved[p.id]} in open tabs
                      </div>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          data-testid={`toggle-active-${p.id}`}
                          className={`btn btn--sm ${p.active ? 'btn--ghost' : 'btn--success'}`}
                          style={{ fontSize: '0.72rem', marginTop: 2 }}
                          onClick={() => handleToggleActive(p)}
                        >
                          {p.active ? 'Deactivate' : 'Activate'}
                        </button>
                        {!p.uses_supplies && (
                          <button
                            data-testid={`toggle-track-inventory-${p.id}`}
                            className={`btn btn--sm ${p.track_inventory === false ? 'btn--primary' : 'btn--ghost'}`}
                            style={{ fontSize: '0.72rem', marginTop: 2 }}
                            onClick={() => handleToggleTrackInventory(p)}
                          >
                            {p.track_inventory === false ? 'Enable tracking' : 'Disable tracking'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {renderSupplySection(p)}
                {renderProviderSection(p)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
