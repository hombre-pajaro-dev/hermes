import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../api/client';
import ProductThumb from './ProductThumb';

type ViewMode = 'grid' | 'list';

interface Props {
  products: Product[];
  onAdd: (product: Product) => void;
  title?: string;
  /** Prefix for add-button test IDs: `${addTestIdPrefix}-${slug}`. Default: 'add' */
  addTestIdPrefix?: string;
  /** If set, wraps stock text in a span with testid `${stockTestIdPrefix}-${slug}` */
  stockTestIdPrefix?: string;
  /** Override displayed price. Default: p.price */
  getPrice?: (p: Product) => number;
  /** Optional note rendered after the price (e.g. "(cost)" label) */
  getPriceNote?: (p: Product) => ReactNode;
  /** Controlled view mode. Default: 'list' */
  viewMode?: ViewMode;
  onViewModeChange?: (m: ViewMode) => void;
  showViewToggle?: boolean;
  viewToggleTestIds?: { grid: string; list: string };
  gridTestId?: string;
  listTestId?: string;
  /** Controlled search value */
  search?: string;
  onSearchChange?: (s: string) => void;
  showSearch?: boolean;
  /** Returns quantity in current order for a product (used for grid highlight) */
  orderQty?: (productId: number) => number | undefined;
  /** Map of product_id → all-time units sold. Enables the "Most Sold" sort toggle. */
  soldCounts?: Record<number, number>;
  /** localStorage key for persisting the sort preference. If omitted the state is not persisted. */
  sortStorageKey?: string;
  /** When true, renders an "Active" filter toggle that hides inactive products. */
  showActiveFilter?: boolean;
  /** localStorage key for persisting the active-only filter. Shared across views. */
  activeFilterStorageKey?: string;
  /** When true, renders an "In Stock" filter toggle that hides out-of-stock products. */
  showStockFilter?: boolean;
  /** localStorage key for persisting the in-stock filter. Shared across views. */
  stockFilterStorageKey?: string;
}

const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

export default function ProductPicker({
  products,
  onAdd,
  title,
  addTestIdPrefix = 'add',
  stockTestIdPrefix,
  getPrice,
  getPriceNote,
  viewMode = 'list',
  onViewModeChange,
  showViewToggle = false,
  viewToggleTestIds,
  gridTestId = 'products-grid',
  listTestId = 'products-list',
  search,
  onSearchChange,
  showSearch = false,
  orderQty,
  soldCounts,
  sortStorageKey,
  showActiveFilter = false,
  activeFilterStorageKey,
  showStockFilter = false,
  stockFilterStorageKey,
}: Props) {
  const [sortByMostSold, setSortByMostSold] = useState<boolean>(() => {
    if (sortStorageKey) {
      const stored = localStorage.getItem(sortStorageKey);
      if (stored !== null) return stored === 'true';
    }
    return true;
  });

  const [activeOnly, setActiveOnly] = useState<boolean>(() => {
    if (activeFilterStorageKey) {
      const stored = localStorage.getItem(activeFilterStorageKey);
      if (stored !== null) return stored === 'true';
    }
    return true; // on by default
  });

  function toggleSort() {
    const next = !sortByMostSold;
    setSortByMostSold(next);
    if (sortStorageKey) localStorage.setItem(sortStorageKey, String(next));
  }

  const [inStockOnly, setInStockOnly] = useState<boolean>(() => {
    if (stockFilterStorageKey) {
      const stored = localStorage.getItem(stockFilterStorageKey);
      if (stored !== null) return stored === 'true';
    }
    return true; // on by default
  });

  function toggleActiveFilter() {
    const next = !activeOnly;
    setActiveOnly(next);
    if (activeFilterStorageKey) localStorage.setItem(activeFilterStorageKey, String(next));
  }

  function toggleStockFilter() {
    const next = !inStockOnly;
    setInStockOnly(next);
    if (stockFilterStorageKey) localStorage.setItem(stockFilterStorageKey, String(next));
  }

  const activeFiltered = showActiveFilter && activeOnly
    ? products.filter(p => p.active !== false)
    : products;

  const stockFiltered = showStockFilter && inStockOnly
    ? activeFiltered.filter(p => p.track_inventory === false || p.units > 0)
    : activeFiltered;

  const displayProducts = soldCounts && sortByMostSold
    ? [...stockFiltered].sort((a, b) => (soldCounts[b.id] ?? 0) - (soldCounts[a.id] ?? 0))
    : stockFiltered;

  const effectivePrice = (p: Product) => (getPrice ? getPrice(p) : p.price);
  const hasHeader = title || (showViewToggle && onViewModeChange && viewToggleTestIds) || soldCounts || showActiveFilter || showStockFilter;

  const hasFilters = showActiveFilter || showStockFilter || !!soldCounts;
  const hasViewToggle = showViewToggle && onViewModeChange && viewToggleTestIds;

  return (
    <div>
      {hasHeader && (
        <div style={{ marginBottom: showSearch ? 4 : 8 }}>
          {/* Row 1: title + view toggle */}
          {(title || hasViewToggle) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasFilters ? 4 : 0 }}>
              {title && <div className="card__title" style={{ flex: 1, marginBottom: 0 }}>{title}</div>}
              {hasViewToggle && (
                <div className="view-toggle" style={{ flexShrink: 0 }}>
                  <button
                    data-testid={viewToggleTestIds!.grid}
                    className={`view-toggle__btn${viewMode === 'grid' ? ' active' : ''}`}
                    onClick={() => onViewModeChange!('grid')}
                    title="Grid view"
                  >⊞</button>
                  <button
                    data-testid={viewToggleTestIds!.list}
                    className={`view-toggle__btn${viewMode === 'list' ? ' active' : ''}`}
                    onClick={() => onViewModeChange!('list')}
                    title="List view"
                  >☰</button>
                </div>
              )}
            </div>
          )}
          {/* Row 2: filter buttons — wrap so they never cause horizontal scroll */}
          {hasFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {showActiveFilter && (
                <button
                  data-testid="active-filter-btn"
                  className={`btn btn--sm ${activeOnly ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={toggleActiveFilter}
                  title={activeOnly ? 'Showing active products only — click to show all' : 'Showing all products — click to show active only'}
                  style={{ fontSize: '0.72rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                >
                  ● Active
                </button>
              )}
              {showStockFilter && (
                <button
                  data-testid="stock-filter-btn"
                  className={`btn btn--sm ${inStockOnly ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={toggleStockFilter}
                  title={inStockOnly ? 'Showing in-stock products only — click to show all' : 'Showing all products — click to show in-stock only'}
                  style={{ fontSize: '0.72rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                >
                  ◈ In Stock
                </button>
              )}
              {soldCounts && (
                <button
                  data-testid="sort-by-sold-btn"
                  className={`btn btn--sm ${sortByMostSold ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={toggleSort}
                  title={sortByMostSold ? 'Sorted by most sold — click to disable' : 'Sort by most sold'}
                  style={{ fontSize: '0.72rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                >
                  ↑ Most Sold
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showSearch && (
        <input
          data-testid="product-search"
          className="input"
          type="search"
          placeholder="Search products…"
          value={search ?? ''}
          onChange={e => onSearchChange?.(e.target.value)}
          style={{ marginBottom: 10 }}
        />
      )}

      <div style={{ maxHeight: '45vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {viewMode === 'grid' ? (
          <div className="products-grid" data-testid={gridTestId}>
            {displayProducts.map(p => {
              const qty = orderQty?.(p.id);
              return (
                <button
                  key={p.id}
                  data-testid={`${addTestIdPrefix}-${toSlug(p.name)}`}
                  className="product-card"
                  style={{ border: qty ? '2px solid var(--primary)' : undefined, cursor: 'pointer', textAlign: 'left', width: '100%', padding: 0, overflow: 'hidden' }}
                  onClick={() => onAdd(p)}
                  disabled={p.track_inventory !== false && p.units <= 0}
                >
                  <div style={{ width: '100%', height: 72, background: '#f3f4f6', borderBottom: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                    {p.image
                      ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: '1.8rem' }}>📷</div>
                    }
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div className="product-card__name">{p.name}</div>
                    <div className="product-card__price">${effectivePrice(p).toFixed(2)}</div>
                    <div className="product-card__meta">{p.track_inventory === false ? '∞ no tracking' : p.units > 0 ? `${p.units} in stock` : 'Out of stock'}</div>
                    {qty && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>× {qty} in order</div>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid={listTestId}>
            {displayProducts.map(p => (
              <div className="list-item" key={p.id} style={{ gap: 10 }}>
                <ProductThumb image={p.image} name={p.name} size={40} />
                <div className="list-item__main">
                  <div className="list-item__name">{p.name}</div>
                  <div className="list-item__sub">
                    ${effectivePrice(p).toFixed(2)}
                    {getPriceNote?.(p)}
                    {stockTestIdPrefix
                      ? (
                        <span data-testid={`${stockTestIdPrefix}-${toSlug(p.name)}`} style={{ marginLeft: 8 }}>
                          {p.track_inventory === false ? '· ∞' : p.units > 0 ? `· ${p.units} in stock` : <span style={{ color: 'var(--danger)' }}>· out of stock</span>}
                        </span>
                      ) : (
                        <span style={{ marginLeft: 8 }}>
                          {p.track_inventory === false ? '· ∞' : p.units > 0 ? `· ${p.units} in stock` : <span style={{ color: 'var(--danger)' }}>· out of stock</span>}
                        </span>
                      )
                    }
                  </div>
                </div>
                <button
                  data-testid={`${addTestIdPrefix}-${toSlug(p.name)}`}
                  className="btn btn--sm btn--primary"
                  onClick={() => onAdd(p)}
                  disabled={p.track_inventory !== false && p.units <= 0}
                >+</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
