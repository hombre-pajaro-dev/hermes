const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const BASE = apiBaseUrl ? `${apiBaseUrl}/api` : '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data: { error?: string } | undefined;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Unexpected response from server' : `Server error (${res.status}) — please check the connection`);
  }
  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  return data as T;
}

export const api = {
  // Products
  getProducts: () => req<Product[]>('/products'),
  getProduct: (name: string) => req<Product>(`/products?name=${encodeURIComponent(name)}`),
  createProduct: (body: Omit<Product, 'id' | 'uses_supplies' | 'supply_ingredients'> & { supply_ingredients?: { supply_id: number; quantity_per_unit: number }[] }) =>
    req<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updatePrice: (id: number, price: number) => req<Product>(`/products/${id}/price`, { method: 'PATCH', body: JSON.stringify({ price }) }),
  updateCost: (id: number, cost: number) => req<Product>(`/products/${id}/cost`, { method: 'PATCH', body: JSON.stringify({ cost }) }),
  updateImage: (id: number, image: string | null) => req<Product>(`/products/${id}/image`, { method: 'PATCH', body: JSON.stringify({ image }) }),
  setProductActive: (id: number, active: boolean) => req<Product>(`/products/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  // Register
  getSession: () => req<RegisterSession | null>('/register/session'),
  openRegister: (opening_cash: number) => req<RegisterSession>('/register/open', { method: 'POST', body: JSON.stringify({ opening_cash }) }),
  cashout: (amount: number, reason: string) => req<Cashout>('/register/cashout', { method: 'POST', body: JSON.stringify({ amount, reason }) }),
  closeRegister: (closing_cash: number) => req<RegisterSession>('/register/close', { method: 'POST', body: JSON.stringify({ closing_cash }) }),
  getCloseBrief: () => req<CloseBrief>('/register/close-brief'),

  // Checkout
  createOrder: (items: OrderItem[]) => req<Order>('/checkout/orders', { method: 'POST', body: JSON.stringify({ items }) }),
  payOrder: (id: number, payment_method: string, amount_received?: number, discount_id?: number) =>
    req<Order>(`/checkout/orders/${id}/pay`, { method: 'POST', body: JSON.stringify({ payment_method, amount_received, discount_id }) }),

  // Tabs
  getTabs: () => req<Tab[]>('/tabs'),
  getTabsSummary: () => req<TabsSummary>('/tabs/summary'),
  openTab: (name: string, at_cost?: boolean) => req<Tab>('/tabs', { method: 'POST', body: JSON.stringify({ name, at_cost }) }),
  getTab: (id: number) => req<Tab & { items: TabItem[] }>(`/tabs/${id}`),
  addTabItems: (id: number, items: OrderItem[]) => req<Tab & { items: TabItem[] }>(`/tabs/${id}/items`, { method: 'POST', body: JSON.stringify({ items }) }),
  updateTabItem: (tabId: number, itemId: number, quantity: number) =>
    req<Tab & { items: TabItem[] }>(`/tabs/${tabId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  payTab: (id: number, payment_method: string, amount_received?: number, discount_id?: number) =>
    req<Tab>(`/tabs/${id}/pay`, { method: 'POST', body: JSON.stringify({ payment_method, amount_received, discount_id }) }),
  voidTab: (id: number) => req<Tab>(`/tabs/${id}/void`, { method: 'POST' }),

  // Ledger
  getLedger: () => req<LedgerEntry[]>('/ledger'),
  getLedgerItems: (id: number) => req<LedgerEntryItem[]>(`/ledger/entries/${id}/items`),
  getAccounts: () => req<Account[]>('/ledger/accounts'),
  getBalances: () => req<Balance[]>('/ledger/balances'),
  recordPayroll: (amount: number, account: string, description: string) =>
    req<LedgerEntry>('/ledger/payroll', { method: 'POST', body: JSON.stringify({ amount, account, description }) }),

  // Reports
  getSalesByItem: (date: string) => req<SalesByItem[]>(`/reports/sales-by-item?date=${date}`),
  getDailyTotal: (date: string) => req<DailyTotal>(`/reports/daily-total?date=${date}`),
  getDailyRange: (from: string, to: string) => req<DailyRange[]>(`/reports/daily-range?from=${from}&to=${to}`),
  getCloseBriefReport: (session_id?: number) => req<CloseBrief>(`/reports/close-brief${session_id ? `?session_id=${session_id}` : ''}`),
  getTopProducts: () => req<TopProduct[]>('/reports/top-products'),

  // Restock
  restock: (items: OrderItem[]) => req<RestockOrder>('/restock', { method: 'POST', body: JSON.stringify({ items }) }),

  // Inventory
  adjustInventory: (adjustments: { product_id: number; physical_count: number }[]) =>
    req<AdjustResult>('/inventory/adjust', { method: 'POST', body: JSON.stringify({ adjustments }) }),

  // Admin — PIN
  verifyPin: (pin: string) => req<{ ok: true }>('/admin/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  changePin: (current_pin: string, new_pin: string) => req<{ ok: true }>('/admin/pin/change', { method: 'POST', body: JSON.stringify({ current_pin, new_pin }) }),

  // Admin — Authorized users
  getAuthorizedUsers: () => req<AuthorizedUser[]>('/admin/users'),
  addAuthorizedUser: (email: string, role: 'staff' | 'admin') => req<AuthorizedUser>('/admin/users', { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateAuthorizedUserRole: (id: number, role: 'staff' | 'admin') => req<AuthorizedUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeAuthorizedUser: (id: number) => req<{ ok: true }>(`/admin/users/${id}`, { method: 'DELETE' }),

  // Supplies
  getSupplies: () => req<Supply[]>('/supplies'),
  createSupply: (body: { name: string; unit: string; quantity: number }) =>
    req<Supply>('/supplies', { method: 'POST', body: JSON.stringify(body) }),
  updateSupply: (id: number, body: Partial<{ name: string; unit: string; quantity: number }>) =>
    req<Supply>(`/supplies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSupply: (id: number) => req<{ ok: true }>(`/supplies/${id}`, { method: 'DELETE' }),
  restockSupply: (id: number, quantity: number) =>
    req<Supply>(`/supplies/${id}/restock`, { method: 'POST', body: JSON.stringify({ quantity }) }),
  setProductSupplies: (productId: number, supply_ingredients: { supply_id: number; quantity_per_unit: number }[]) =>
    req<Product>(`/products/${productId}/supplies`, { method: 'PATCH', body: JSON.stringify({ supply_ingredients }) }),

  // Discounts
  getDiscounts: () => req<Discount[]>('/discounts'),
  createDiscount: (body: Omit<Discount, 'id' | 'redemptions' | 'created_at'>) =>
    req<Discount>('/discounts', { method: 'POST', body: JSON.stringify(body) }),
  updateDiscount: (id: number, body: Partial<Omit<Discount, 'id' | 'created_at'>>) =>
    req<Discount>(`/discounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDiscount: (id: number) => req<{ ok: true }>(`/discounts/${id}`, { method: 'DELETE' }),
};

// Types
export interface SupplyIngredient { supply_id: number; quantity_per_unit: number; supply_name: string; unit: string; }
export interface Product { id: number; name: string; description: string; cost: number; price: number; units: number; image?: string | null; active: boolean; uses_supplies: boolean; supply_ingredients: SupplyIngredient[]; }
export interface Supply { id: number; name: string; unit: string; quantity: number; created_at: string; }
export interface RegisterSession { id: number; status: string; opening_cash: number; closing_cash?: number; opened_at: string; closed_at?: string; }
export interface Cashout { id: number; session_id: number; amount: number; reason: string; created_at: string; }
export interface OrderItem { product_id: number; quantity: number; }
export interface Order { id: number; status: string; total: number; discount_amount?: number; payment_method?: string; amount_received?: number; change_due?: number; items?: unknown[]; }
export interface Tab { id: number; name: string; status: string; at_cost: number; total: number; discount_amount?: number; payment_method?: string; created_at: string; paid_at?: string; }
export interface TabItem { id: number; product_id: number; quantity: number; unit_price: number; subtotal: number; }
export interface TabsSummary { open_count: number; total_amount: number; }
export interface LedgerEntry { id: number; entry_type: string; account?: string; amount: number; description: string; ref_id?: number; ref_type?: string; created_at: string; discount_name?: string; discount_amount?: number; }
export interface LedgerEntryItem { product_id: number; name: string; quantity: number; unit_price: number; subtotal: number; }
export interface Account { id: number; name: string; label: string; }
export interface Balance { account: string; balance: number; }
export interface SalesByItem { product_id: number; name: string; units_sold: number; revenue: number; cost: number; }
export interface DailyTotal { date: string; order_count: number; total_sales: number; cash_sales?: number; card_sales?: number; total_cost: number; }
export interface DailyRange { date: string; revenue: number; cost: number; order_count: number; }
export interface TopProduct { product_id: number; units_sold: number; }
export interface CloseBrief { session_id: number; revenue: number; total_cost: number; gross_profit: number; most_sold?: { name: string; units_sold: number } | null; most_profitable?: { name: string; profit: number } | null; by_item: SalesByItem[]; }
export interface RestockOrder { id: number; session_id: number; items: { product_id: number; name: string; quantity: number; new_units: number }[]; }
export interface AdjustResult { adjustments: { product_id: number; name: string; previous_units: number; physical_count: number; delta: number; new_units: number }[]; }
export interface AuthorizedUser { id: number; email: string; role: 'staff' | 'admin'; created_at: string; }
export interface Discount {
  id: number;
  name: string;
  description: string;
  active: boolean;
  type: 'percentage' | 'bxgy';
  value: number | null;
  buy_qty: number | null;
  get_qty: number | null;
  is_manual: boolean;
  requires_pin: boolean;
  days_of_week: number[] | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  redemptions: number;
  product_ids: number[];
  created_at: string;
}
