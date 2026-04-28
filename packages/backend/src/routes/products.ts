import { Router } from 'express';
import { getDb, pool } from '../db/database.js';

const router = Router();

// Shared SELECT that computes units from supplies when applicable and includes supply_ingredients.
const PRODUCT_SELECT = `
  SELECT
    p.id, p.name, p.description, p.cost, p.price, p.image, p.active, p.track_inventory,
    CASE
      WHEN EXISTS(SELECT 1 FROM product_supplies ps WHERE ps.product_id = p.id)
      THEN COALESCE((
        SELECT FLOOR(MIN(s.quantity / ps.quantity_per_unit))
        FROM product_supplies ps
        JOIN supplies s ON s.id = ps.supply_id
        WHERE ps.product_id = p.id AND ps.quantity_per_unit > 0
      ), 0)
      ELSE p.units
    END AS units,
    EXISTS(SELECT 1 FROM product_supplies ps WHERE ps.product_id = p.id) AS uses_supplies,
    COALESCE((
      SELECT json_agg(json_build_object(
        'supply_id',        ps.supply_id,
        'quantity_per_unit', ps.quantity_per_unit,
        'supply_name',      s.name,
        'unit',             s.unit
      ))
      FROM product_supplies ps
      JOIN supplies s ON s.id = ps.supply_id
      WHERE ps.product_id = p.id
    ), '[]'::json) AS supply_ingredients,
    ppr.provider_id,
    prv.name AS provider_name
  FROM products p
  LEFT JOIN product_providers ppr ON ppr.product_id = p.id
  LEFT JOIN providers prv ON prv.id = ppr.provider_id
`;

router.get('/', async (req, res) => {
  const db = await getDb();
  if (req.query.name) {
    const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.name = $1`, [req.query.name]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  }
  const { rows } = await db.query(`${PRODUCT_SELECT} ORDER BY p.name`);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { name, description = '', cost, price, units = 0, image = null, supply_ingredients } = req.body as {
    name: string; description?: string; cost: number; price: number; units?: number; image?: string | null;
    supply_ingredients?: { supply_id: number; quantity_per_unit: number }[];
  };
  if (!name || cost == null || price == null) {
    return res.status(400).json({ error: 'name, cost, and price are required' });
  }
  const db = await getDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO products (name, description, cost, price, units, image) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, description, cost, price, units, image],
    );
    const productId = rows[0].id;
    if (supply_ingredients && supply_ingredients.length > 0) {
      for (const si of supply_ingredients) {
        if (si.quantity_per_unit <= 0) throw new Error('quantity_per_unit must be > 0');
        const { rows: [supply] } = await client.query('SELECT id FROM supplies WHERE id = $1', [si.supply_id]);
        if (!supply) throw new Error(`Supply ${si.supply_id} not found`);
        await client.query(
          'INSERT INTO product_supplies (product_id, supply_id, quantity_per_unit) VALUES ($1, $2, $3)',
          [productId, si.supply_id, si.quantity_per_unit],
        );
      }
    }
    await client.query('COMMIT');
    const { rows: [created] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [productId]);
    res.status(201).json(created);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// Set or replace supply ingredients for a product
router.patch('/:id/supplies', async (req, res) => {
  const { supply_ingredients } = req.body as {
    supply_ingredients: { supply_id: number; quantity_per_unit: number }[];
  };
  if (!Array.isArray(supply_ingredients)) {
    return res.status(400).json({ error: 'supply_ingredients must be an array' });
  }
  const db = await getDb();
  const { rows: [product] } = await db.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM product_supplies WHERE product_id = $1', [req.params.id]);
    for (const si of supply_ingredients) {
      if (si.quantity_per_unit <= 0) throw new Error('quantity_per_unit must be > 0');
      const { rows: [supply] } = await client.query('SELECT id FROM supplies WHERE id = $1', [si.supply_id]);
      if (!supply) throw new Error(`Supply ${si.supply_id} not found`);
      await client.query(
        'INSERT INTO product_supplies (product_id, supply_id, quantity_per_unit) VALUES ($1, $2, $3)',
        [req.params.id, si.supply_id, si.quantity_per_unit],
      );
    }
    await client.query('COMMIT');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: (err as Error).message });
  } finally {
    client.release();
  }

  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json(updated);
});

router.patch('/:id/image', async (req, res) => {
  const { image } = req.body;
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  await db.query('UPDATE products SET image = $1 WHERE id = $2', [image ?? null, req.params.id]);
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json(updated);
});

router.patch('/:id/price', async (req, res) => {
  const { price } = req.body;
  if (price == null) return res.status(400).json({ error: 'price is required' });
  if (typeof price !== 'number' || price <= 0) return res.status(400).json({ error: 'price must be greater than 0' });
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  const { rows: openTab } = await db.query(
    `SELECT COUNT(*)::int as count FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id WHERE ti.product_id = $1 AND t.status = 'open'`,
    [req.params.id],
  );
  if (openTab[0].count > 0) return res.status(409).json({ error: 'Cannot modify price: product is in one or more open tabs' });
  await db.query('UPDATE products SET price = $1 WHERE id = $2', [price, req.params.id]);
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json(updated);
});

router.patch('/:id/cost', async (req, res) => {
  const { cost } = req.body;
  if (cost == null) return res.status(400).json({ error: 'cost is required' });
  if (typeof cost !== 'number' || cost <= 0) return res.status(400).json({ error: 'cost must be greater than 0' });
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  const { rows: openTab } = await db.query(
    `SELECT COUNT(*)::int as count FROM tab_items ti JOIN tabs t ON t.id = ti.tab_id WHERE ti.product_id = $1 AND t.status = 'open'`,
    [req.params.id],
  );
  if (openTab[0].count > 0) return res.status(409).json({ error: 'Cannot modify cost: product is in one or more open tabs' });
  await db.query('UPDATE products SET cost = $1 WHERE id = $2', [cost, req.params.id]);
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json(updated);
});

router.patch('/:id/active', async (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active must be a boolean' });
  const db = await getDb();
  await db.query('UPDATE products SET active = $1 WHERE id = $2', [active, req.params.id]);
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

router.patch('/:id/track-inventory', async (req, res) => {
  const { track_inventory } = req.body;
  if (typeof track_inventory !== 'boolean') return res.status(400).json({ error: 'track_inventory must be a boolean' });
  const db = await getDb();
  await db.query('UPDATE products SET track_inventory = $1 WHERE id = $2', [track_inventory, req.params.id]);
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

router.patch('/:id/provider', async (req, res) => {
  const { provider_id } = req.body as { provider_id: number | null };
  const db = await getDb();
  const { rows: [product] } = await db.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (provider_id == null) {
    await db.query('DELETE FROM product_providers WHERE product_id = $1', [req.params.id]);
  } else {
    const { rows: [prov] } = await db.query('SELECT id FROM providers WHERE id = $1', [provider_id]);
    if (!prov) return res.status(404).json({ error: 'Provider not found' });
    await db.query(
      'INSERT INTO product_providers (product_id, provider_id) VALUES ($1, $2) ON CONFLICT (product_id, provider_id) DO NOTHING',
      [req.params.id, provider_id],
    );
    // Remove any previous link to a different provider
    await db.query(
      'DELETE FROM product_providers WHERE product_id = $1 AND provider_id != $2',
      [req.params.id, provider_id],
    );
  }
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json(updated);
});

router.put('/:id', async (req, res) => {
  const { name, description, cost, price, units } = req.body;
  const db = await getDb();
  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Product not found' });
  const e = existing[0];
  await db.query(
    'UPDATE products SET name=$1, description=$2, cost=$3, price=$4, units=$5 WHERE id=$6',
    [name ?? e.name, description ?? e.description, cost ?? e.cost, price ?? e.price, units ?? e.units, req.params.id],
  );
  const { rows: [updated] } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json(updated);
});

export default router;
