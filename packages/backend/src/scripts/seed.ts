import { pool, schemaReady } from '../db/database.js';

const products = [
  { name: 'Espresso',       description: 'Single shot espresso',            cost: 0.50, price: 2.50,  units: 50 },
  { name: 'Americano',      description: 'Espresso with hot water',         cost: 0.60, price: 3.00,  units: 50 },
  { name: 'Latte',          description: 'Espresso with steamed milk',      cost: 0.90, price: 4.00,  units: 40 },
  { name: 'Cappuccino',     description: 'Espresso with foamed milk',       cost: 0.90, price: 4.00,  units: 40 },
  { name: 'Flat White',     description: 'Ristretto with microfoam milk',   cost: 0.95, price: 4.50,  units: 35 },
  { name: 'Macchiato',      description: 'Espresso with a dollop of foam',  cost: 0.60, price: 3.00,  units: 30 },
  { name: 'Cold Brew',      description: '12-hour cold steep coffee',       cost: 1.00, price: 4.50,  units: 20 },
  { name: 'Matcha Latte',   description: 'Ceremonial grade matcha + milk',  cost: 1.20, price: 5.00,  units: 25 },
  { name: 'Chai Latte',     description: 'Spiced tea with steamed milk',    cost: 1.10, price: 4.50,  units: 30 },
  { name: 'Hot Chocolate',  description: 'Rich dark chocolate drink',       cost: 1.00, price: 4.00,  units: 30 },
  { name: 'Orange Juice',   description: 'Freshly squeezed OJ',            cost: 1.50, price: 4.50,  units: 20 },
  { name: 'Sparkling Water', description: '330ml sparkling water',          cost: 0.40, price: 2.00,  units: 60 },
  { name: 'Croissant',      description: 'Butter croissant',                cost: 0.80, price: 3.50,  units: 24 },
  { name: 'Banana Bread',   description: 'Slice of house banana bread',     cost: 0.90, price: 4.00,  units: 15 },
  { name: 'Avocado Toast',  description: 'Sourdough + avocado + chilli',   cost: 2.50, price: 9.00,  units: 12 },
];

async function seed() {
  await schemaReady;

  for (const p of products) {
    await pool.query(
      `INSERT INTO products (name, description, cost, price, units)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET description = $2, cost = $3, price = $4, units = EXCLUDED.units`,
      [p.name, p.description, p.cost, p.price, p.units]
    );
  }

  console.log(`Seeded ${products.length} products.`);
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
