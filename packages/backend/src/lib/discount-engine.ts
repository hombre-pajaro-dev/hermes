export interface DiscountRow {
  id: number;
  type: string;
  value: number | null;
  buy_qty: number | null;
  get_qty: number | null;
  active: boolean;
  is_manual: boolean;
  days_of_week: number[] | null;
  valid_from: Date | string | null;
  valid_until: Date | string | null;
  max_redemptions: number | null;
  redemptions: number;
  name: string;
  snapshot_type?: string;
}

export interface ItemRow {
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/**
 * Returns true if the discount passes all time/date/redemption conditions right now.
 * NOTE: uses server UTC time. For a café open only during business hours this is fine.
 */
export function isDiscountEligibleNow(d: DiscountRow): boolean {
  if (!d.active) return false;
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  if (d.days_of_week && d.days_of_week.length > 0 && !d.days_of_week.includes(day)) return false;
  if (d.valid_from && new Date(d.valid_from) > now) return false;
  if (d.valid_until && new Date(d.valid_until) < now) return false;
  if (d.max_redemptions !== null && d.max_redemptions !== undefined && d.redemptions >= d.max_redemptions) return false;
  return true;
}

/**
 * Computes the dollar amount saved by applying a discount to a set of order/tab items.
 * productIds — the qualifying product IDs for this discount (empty = whole order, percentage only).
 */
export function computeDiscountAmount(d: DiscountRow, productIds: number[], items: ItemRow[]): number {
  if (d.type === 'percentage') {
    const pct = d.value ?? 0;
    const eligible = productIds.length === 0 ? items : items.filter(i => productIds.includes(i.product_id));
    const base = eligible.reduce((s, i) => s + Number(i.subtotal), 0);
    return round(base * (pct / 100));
  }

  if (d.type === 'bxgy') {
    const buyQty = d.buy_qty ?? 2;
    const getQty = d.get_qty ?? 1;
    const groupSize = buyQty + getQty;
    const eligible = items.filter(i => productIds.includes(i.product_id));
    // Expand to individual unit prices
    const units: number[] = [];
    for (const item of eligible) {
      for (let j = 0; j < Number(item.quantity); j++) units.push(Number(item.unit_price));
    }
    units.sort((a, b) => a - b); // cheapest first → they become the free ones
    let savings = 0;
    for (let i = 0; i + groupSize <= units.length; i += groupSize) {
      for (let j = 0; j < getQty; j++) savings += units[i + j];
    }
    return round(savings);
  }

  return 0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
