type Queryable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
};

/** Returns true if the product has supply ingredients configured. */
export async function productUsesSupplies(db: Queryable, product_id: number): Promise<boolean> {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int as cnt FROM product_supplies WHERE product_id = $1',
    [product_id],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/**
 * Returns available units for a product.
 * Non-tracked products return 999999 (always available).
 * For supply-based products: floor(min(supply.quantity / qty_per_unit)).
 * For unit-based products: product.units.
 */
export async function getProductAvailableUnits(db: Queryable, product_id: number): Promise<number> {
  const { rows } = await db.query(
    `SELECT
       CASE
         WHEN p.track_inventory = FALSE THEN 999999
         WHEN EXISTS(SELECT 1 FROM product_supplies ps WHERE ps.product_id = $1)
         THEN COALESCE((
           SELECT FLOOR(MIN(s.quantity / ps.quantity_per_unit))
           FROM product_supplies ps
           JOIN supplies s ON s.id = ps.supply_id
           WHERE ps.product_id = $1 AND ps.quantity_per_unit > 0
         ), 0)
         ELSE p.units
       END AS available_units
     FROM products p WHERE p.id = $1`,
    [product_id],
  );
  return Number(rows[0]?.available_units ?? 0);
}

/**
 * Returns a product's cost.
 * For supply-based products: sum(quantity_per_unit * supply.cost) across product_supplies.
 * For all other products: the stored products.cost column.
 */
export async function getProductCost(db: Queryable, product_id: number): Promise<number> {
  const { rows } = await db.query(
    `SELECT
       CASE
         WHEN EXISTS(SELECT 1 FROM product_supplies ps WHERE ps.product_id = $1)
         THEN COALESCE((
           SELECT SUM(ps.quantity_per_unit * s.cost)
           FROM product_supplies ps
           JOIN supplies s ON s.id = ps.supply_id
           WHERE ps.product_id = $1
         ), 0)
         ELSE p.cost
       END AS cost
     FROM products p WHERE p.id = $1`,
    [product_id],
  );
  return Number(rows[0]?.cost ?? 0);
}

/**
 * Deducts `quantity` product units from supplies (if supply-based) or product.units.
 * No-op for non-tracked products. Must be called inside a transaction client.
 */
export async function deductProductStock(db: Queryable, product_id: number, quantity: number): Promise<void> {
  const { rows: [p] } = await db.query('SELECT track_inventory FROM products WHERE id = $1', [product_id]);
  if (p?.track_inventory === false) return;
  const usesSupplies = await productUsesSupplies(db, product_id);
  if (usesSupplies) {
    await db.query(
      `UPDATE supplies
       SET quantity = quantity - (ps.quantity_per_unit * $1)
       FROM product_supplies ps
       WHERE ps.supply_id = supplies.id AND ps.product_id = $2`,
      [quantity, product_id],
    );
  } else {
    await db.query('UPDATE products SET units = units - $1 WHERE id = $2', [quantity, product_id]);
  }
}

/**
 * Restores `quantity` product units to supplies (if supply-based) or product.units.
 * No-op for non-tracked products. Must be called inside a transaction client.
 */
export async function restoreProductStock(db: Queryable, product_id: number, quantity: number): Promise<void> {
  const { rows: [p] } = await db.query('SELECT track_inventory FROM products WHERE id = $1', [product_id]);
  if (p?.track_inventory === false) return;
  const usesSupplies = await productUsesSupplies(db, product_id);
  if (usesSupplies) {
    await db.query(
      `UPDATE supplies
       SET quantity = quantity + (ps.quantity_per_unit * $1)
       FROM product_supplies ps
       WHERE ps.supply_id = supplies.id AND ps.product_id = $2`,
      [quantity, product_id],
    );
  } else {
    await db.query('UPDATE products SET units = units + $1 WHERE id = $2', [quantity, product_id]);
  }
}
