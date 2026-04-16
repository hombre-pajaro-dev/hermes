import type { Product, Supply } from '../api/client';

/**
 * Returns a new products array with each product's `units` field adjusted to
 * reflect what the current checkout cart has already consumed.
 *
 * For supply-based products: deducts cart consumption from each shared supply,
 * then recomputes floor(min(remaining / qty_per_unit)).  Two products that
 * share a supply will both show reduced availability as soon as either one is
 * added to the cart.
 *
 * For unit-based products: subtracts the quantity already in the cart from the
 * server-side units, so the picker shows "how many more can still be added".
 *
 * No network calls — pure derivation from already-loaded state.
 */
export function computeCartAwareProducts(
  products: Product[],
  supplies: Supply[],
  cart: Record<number, number>,   // product_id → quantity in cart
): Product[] {
  // Build remaining supply quantities after subtracting cart consumption.
  const remaining: Record<number, number> = {};
  for (const s of supplies) {
    remaining[s.id] = s.quantity;
  }
  for (const p of products) {
    const qty = cart[p.id] ?? 0;
    if (qty > 0 && p.uses_supplies) {
      for (const si of p.supply_ingredients) {
        remaining[si.supply_id] = (remaining[si.supply_id] ?? 0) - si.quantity_per_unit * qty;
      }
    }
  }

  // Recompute each product's effective available units.
  return products.map(p => {
    const cartQty = cart[p.id] ?? 0;
    let effectiveUnits: number;

    if (p.uses_supplies && p.supply_ingredients.length > 0) {
      let min = Infinity;
      for (const si of p.supply_ingredients) {
        const rem = remaining[si.supply_id] ?? 0;
        min = Math.min(min, Math.floor(rem / si.quantity_per_unit));
      }
      effectiveUnits = Math.max(0, isFinite(min) ? min : 0);
    } else {
      // Unit-based: subtract what's already in the cart.
      effectiveUnits = Math.max(0, p.units - cartQty);
    }

    return { ...p, units: effectiveUnits };
  });
}
