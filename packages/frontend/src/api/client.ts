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
  createProduct: (body: Omit<Product, 'id' | 'uses_supplies' | 'supply_ingredients' | 'staff_price'> & { supply_ingredients?: { supply_id: number; quantity_per_unit: number }[] }) =>
    req<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updatePrice: (id: number, price: number) => req<Product>(`/products/${id}/price`, { method: 'PATCH', body: JSON.stringify({ price }) }),
  updateCost: (id: number, cost: number) => req<Product>(`/products/${id}/cost`, { method: 'PATCH', body: JSON.stringify({ cost }) }),
  updateStaffPrice: (id: number, staff_price: number) => req<Product>(`/products/${id}/staff_price`, { method: 'PATCH', body: JSON.stringify({ staff_price }) }),
  updateImage: (id: number, image: string | null) => req<Product>(`/products/${id}/image`, { method: 'PATCH', body: JSON.stringify({ image }) }),
  setProductActive: (id: number, active: boolean) => req<Product>(`/products/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  setProductTrackInventory: (id: number, track_inventory: boolean) => req<Product>(`/products/${id}/track-inventory`, { method: 'PATCH', body: JSON.stringify({ track_inventory }) }),

  // Register
  getSession: () => req<RegisterSession | null>('/register/session'),
  openRegister: (opening_cash: number) => req<RegisterSession>('/register/open', { method: 'POST', body: JSON.stringify({ opening_cash }) }),
  cashout: (amount: number, reason: string) => req<Cashout>('/register/cashout', { method: 'POST', body: JSON.stringify({ amount, reason }) }),
  closeRegister: (closing_cash: number) => req<RegisterSession>('/register/close', { method: 'POST', body: JSON.stringify({ closing_cash }) }),
  getCloseBrief: () => req<CloseBrief>('/register/close-brief'),
  getRegisterSessions: () => req<RegisterSessionSummary[]>('/register/sessions'),
  getSessionReport: (id: number) => req<SessionReport>(`/register/sessions/${id}/report`),

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
  adjustAccount: (account: string, amount: number, description: string) =>
    req<LedgerEntry>('/ledger/adjustment', { method: 'POST', body: JSON.stringify({ account, amount, description }) }),
  transferBetweenAccounts: (from_account: string, to_account: string, amount: number, description?: string) =>
    req<{ debit: LedgerEntry; credit: LedgerEntry }>('/ledger/transfer', { method: 'POST', body: JSON.stringify({ from_account, to_account, amount, description }) }),

  // Reports
  getSalesByItem: (from: string, to: string, tz: string) => req<SalesByItem[]>(`/reports/sales-by-item?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}`),
  getDailyTotal: (from: string, to: string, tz: string) => req<DailyTotal>(`/reports/daily-total?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}`),
  getDailyRange: (from: string, to: string, tz: string) => req<DailyRange[]>(`/reports/daily-range?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}`),
  getCloseBriefReport: (session_id?: number) => req<CloseBrief>(`/reports/close-brief${session_id ? `?session_id=${session_id}` : ''}`),
  getTopProducts: () => req<TopProduct[]>('/reports/top-products'),
  getInventoryAdjustmentReport: (from: string, to: string, tz: string) => req<InventoryAdjustmentItem[]>(`/reports/inventory-adjustments?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}`),
  getHistoricReport: (groupBy: 'week' | 'month' | 'day', tz: string, year?: number) =>
    req<HistoricReport>(`/reports/historic?groupBy=${groupBy}&tz=${encodeURIComponent(tz)}${year ? `&year=${year}` : ''}`),
  getWeekdayReport: (tz: string, year?: number) =>
    req<WeekdayReport>(`/reports/by-weekday?tz=${encodeURIComponent(tz)}${year ? `&year=${year}` : ''}`),

  // Restock
  restock: (items: RestockItem[], meta?: { provider_id?: number; payment_account?: string }) =>
    req<RestockOrder>('/restock', { method: 'POST', body: JSON.stringify({ items, ...meta }) }),

  // Providers
  getProviders: () => req<Provider[]>('/providers'),
  createProvider: (name: string) => req<Provider>('/providers', { method: 'POST', body: JSON.stringify({ name }) }),
  providerPayment: (id: number, amount: number, account: string, description?: string) =>
    req<LedgerEntry>(`/providers/${id}/payment`, { method: 'POST', body: JSON.stringify({ amount, account, description }) }),
  getSessionBill: (from: string, to: string, tz: string) =>
    req<ProviderBill[]>(`/providers/session-bill?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}`),
  setProductProvider: (productId: number, provider_id: number | null) =>
    req<Product>(`/products/${productId}/provider`, { method: 'PATCH', body: JSON.stringify({ provider_id }) }),

  // Inventory
  adjustInventory: (adjustments: { product_id: number; physical_count: number }[]) =>
    req<AdjustResult>('/inventory/adjust', { method: 'POST', body: JSON.stringify({ adjustments }) }),

  // Admin — Authorized users
  getAuthorizedUsers: () => req<AuthorizedUser[]>('/admin/users'),
  addAuthorizedUser: (email: string, role: 'staff' | 'admin') => req<AuthorizedUser>('/admin/users', { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateAuthorizedUserRole: (id: number, role: 'staff' | 'admin') => req<AuthorizedUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeAuthorizedUser: (id: number) => req<{ ok: true }>(`/admin/users/${id}`, { method: 'DELETE' }),

  // Admin — Commission settings
  getCommissionSettings: () => req<CommissionSettings>('/admin/commissions'),
  updateCommissionSettings: (body: Partial<{ rate: number; iva_rate: number }>) =>
    req<CommissionSettings>('/admin/commissions', { method: 'PATCH', body: JSON.stringify(body) }),

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

  // Payees & Payments
  getPayees: () => req<Payee[]>('/payees'),
  createPayee: (body: Omit<Payee, 'id' | 'active' | 'created_at'>) =>
    req<Payee>('/payees', { method: 'POST', body: JSON.stringify(body) }),
  updatePayee: (id: number, body: Partial<Omit<Payee, 'id' | 'created_at'>>) =>
    req<Payee>(`/payees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  runPayments: (entries: PaymentEntry[], note?: string) =>
    req<PaymentRunResult>('/payments/run', { method: 'POST', body: JSON.stringify({ entries, note }) }),

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
export interface Product { id: number; name: string; description: string; cost: number; price: number; staff_price: number; units: number; image?: string | null; active: boolean; track_inventory: boolean; uses_supplies: boolean; supply_ingredients: SupplyIngredient[]; provider_id?: number | null; provider_name?: string | null; }
export interface Supply { id: number; name: string; unit: string; quantity: number; created_at: string; }
export interface RegisterSession { id: number; status: string; opening_cash: number; closing_cash?: number; opened_at: string; closed_at?: string; }
export interface RegisterSessionSummary { id: number; status: string; opening_cash: number; closing_cash: number | null; opened_at: string; closed_at: string | null; }
export interface InventorySnapshotEntry { id: number; name: string; units: number; }
export interface SupplySnapshotEntry { id: number; name: string; unit: string; quantity: number; }
export interface SessionInventorySnapshot { products: InventorySnapshotEntry[]; supplies: SupplySnapshotEntry[]; }
export interface SessionReport {
  session: RegisterSessionSummary & { inventory_snapshot_open: SessionInventorySnapshot | null; inventory_snapshot_close: SessionInventorySnapshot | null; };
  order_count: number; revenue: number; total_cost: number; commission_total?: number; gross_profit: number; cash_sales: number; card_sales: number; expected_cash?: number; cash_variance?: number | null;
  by_item: { product_id: number; name: string; units_sold: number; revenue: number; cost: number; profit: number }[];
  cashouts: { id: number; amount: number; reason: string; created_at: string }[];
  restocked: { product_id: number; name: string; units_restocked: number }[];
  adjustments: { product_id: number; name: string; delta: number }[];
}
export interface Cashout { id: number; session_id: number; amount: number; reason: string; created_at: string; }
export interface OrderItem { product_id: number; quantity: number; }
export interface Order { id: number; status: string; total: number; discount_amount?: number; payment_method?: string; amount_received?: number; change_due?: number; items?: unknown[]; }
export interface Tab { id: number; name: string; status: string; at_cost: number; total: number; discount_amount?: number; payment_method?: string; created_at: string; updated_at?: string; paid_at?: string; items?: TabItem[]; created_by?: string | null; paid_by?: string | null; }
export interface TabItem { id: number; product_id: number; name?: string; quantity: number; unit_price: number; unit_cost: number; subtotal: number; added_by?: string | null; added_at?: string | null; }
export interface TabsSummary { open_count: number; total_amount: number; }
export interface LedgerEntry { id: number; entry_type: string; account?: string; amount: number; description: string; ref_id?: number; ref_type?: string; created_at: string; discount_name?: string; discount_amount?: number; created_by?: string | null; tab_at_cost?: number | null; tab_opened_by?: string | null; }
export interface LedgerEntryItem { product_id: number; name: string; quantity: number; unit_price: number; subtotal: number; previous_cost?: number | null; }
export interface RestockItem { product_id: number; quantity: number; unit_cost: number; }
export interface Account { id: number; name: string; label: string; }
export interface Balance { account: string; balance: number; }
export interface SalesByItem { product_id: number; name: string; units_sold: number; revenue: number; cost: number; }
export interface DailyTotal { date: string; order_count: number; total_sales: number; cash_sales?: number; card_sales?: number; total_cost: number; inventory_adjustment_total?: number; commission_total?: number; }
export interface DailyRange { date: string; revenue: number; cost: number; order_count: number; adjustment?: number; }
export interface TopProduct { product_id: number; units_sold: number; }
export interface InventoryAdjustmentItem { product_id: number; name: string; adjustment_count: number; total_delta: number; total_cost_impact: number; }
export interface CloseBrief { session_id: number; revenue: number; total_cost: number; commission_total?: number; gross_profit: number; expected_cash?: number; cash_variance?: number | null; most_sold?: { name: string; units_sold: number } | null; most_profitable?: { name: string; profit: number } | null; by_item: SalesByItem[]; }
export interface RestockOrder { id: number; session_id: number; provider_id?: number | null; payment_amount?: number | null; payment_account?: string | null; items: { product_id: number; name: string; quantity: number; new_units: number }[]; }
export interface Provider { id: number; name: string; created_at: string; }
export interface ProviderBillItem { product_id: number; product_name: string; qty_sold: number; unit_cost: number; subtotal: number; }
export interface ProviderBill { provider_id: number; provider_name: string; products: ProviderBillItem[]; total: number; }
export interface AdjustResult { adjustments: { product_id: number; name: string; previous_units: number; physical_count: number; delta: number; new_units: number }[]; }
export interface AuthorizedUser { id: number; email: string; role: 'staff' | 'admin'; created_at: string; }
export interface HistoricPeriod { label: string; period_start: string; period_end: string; revenue: number; cost: number; profit: number; order_count: number; }
export interface HistoricReport { groupBy: 'week' | 'month' | 'day'; periods: HistoricPeriod[]; best_period_index: number; median_revenue: number | null; median_cost: number | null; median_profit: number | null; }
export interface WeekdayPeriod { label: string; dow: number; median_revenue: number; median_cost: number; median_profit: number; sample_days: number; }
export interface WeekdayReport { year: number; periods: WeekdayPeriod[]; best_index: number; }

export interface Payee {
  id: number;
  name: string;
  type: 'staff' | 'expense' | 'savings';
  default_weight: number;
  source_account: string;
  active: boolean;
  created_at?: string;
}
export interface PaymentEntry { payee_id: number; amount: number; source_account: string; }
export interface PaymentRunResult { entries: LedgerEntry[]; }

export interface CommissionSettings { rate: number; iva_rate: number; total_paid: number; }

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
