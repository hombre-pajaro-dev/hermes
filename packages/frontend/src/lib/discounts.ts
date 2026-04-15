import type { Discount } from '../api/client';

export interface CartItem {
  product_id: number;
  price: number;
  quantity: number;
}

/** Dollar savings for one discount against the current cart. */
export function computeSavings(discount: Discount, items: CartItem[]): number {
  if (discount.type === 'percentage') {
    const pct = discount.value ?? 0;
    const eligible = discount.product_ids.length === 0
      ? items
      : items.filter(i => discount.product_ids.includes(i.product_id));
    const base = eligible.reduce((s, i) => s + i.price * i.quantity, 0);
    return round(base * (pct / 100));
  }

  if (discount.type === 'bxgy') {
    const buyQty = discount.buy_qty ?? 2;
    const getQty = discount.get_qty ?? 1;
    const groupSize = buyQty + getQty;
    const eligible = items.filter(i => discount.product_ids.includes(i.product_id));
    const units: number[] = [];
    for (const item of eligible) {
      for (let j = 0; j < item.quantity; j++) units.push(item.price);
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

/** Returns true if the discount's conditions pass right now (client-side, using local browser time). */
export function isEligibleNow(discount: Discount): boolean {
  if (!discount.active) return false;
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  if (discount.days_of_week && discount.days_of_week.length > 0 && !discount.days_of_week.includes(day)) return false;
  if (discount.valid_from && new Date(discount.valid_from) > now) return false;
  if (discount.valid_until && new Date(discount.valid_until) < now) return false;
  if (discount.max_redemptions !== null && discount.max_redemptions !== undefined && discount.redemptions >= discount.max_redemptions) return false;
  return true;
}

/** From all active auto-discounts, returns the one with the highest savings, or null. */
export function getBestAutoDiscount(
  discounts: Discount[],
  items: CartItem[],
): { discount: Discount; savings: number } | null {
  const candidates = discounts
    .filter(d => !d.is_manual && isEligibleNow(d))
    .map(d => ({ discount: d, savings: computeSavings(d, items) }))
    .filter(x => x.savings > 0)
    .sort((a, b) => b.savings - a.savings);
  return candidates[0] ?? null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
