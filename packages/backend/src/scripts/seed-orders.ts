/**
 * Seeds historical order data across the last 14 weeks for chart testing.
 * Inserts directly into DB — bypasses register open check.
 */
import { pool, schemaReady } from '../db/database.js';

const TZ = 'America/Monterrey';

function localDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Returns a random int between min and max (inclusive)
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedOrders() {
  await schemaReady;

  // Get products
  const { rows: products } = await pool.query<{ id: number; price: number; cost: number; name: string }>(
    'SELECT id, price, cost, name FROM products ORDER BY id'
  );
  if (products.length === 0) {
    console.error('No products found. Run pnpm seed first.');
    process.exit(1);
  }

  // Ensure a register session exists
  const { rows: sessions } = await pool.query('SELECT id FROM register_sessions LIMIT 1');
  let sessionId: number;
  if (sessions.length > 0) {
    sessionId = sessions[0].id;
  } else {
    const { rows: [s] } = await pool.query(
      "INSERT INTO register_sessions (status, opening_cash, opened_at) VALUES ('open', 200, NOW()) RETURNING id"
    );
    sessionId = s.id;
    console.log(`Created register session ${sessionId}`);
  }

  // Build date range: last 14 weeks
  const today = new Date();
  const todayStr = localDate(today);
  const startDate = addDays(today, -14 * 7);

  let ordersInserted = 0;
  let current = new Date(startDate);
  const endDate = new Date(todayStr + 'T23:59:59');

  while (current <= endDate) {
    const dateStr = localDate(current);
    const dow = current.getDay(); // 0=Sun, 6=Sat

    // Weekends busier, Mondays quieter
    const baseOrders = dow === 0 || dow === 6 ? rand(12, 22) : dow === 1 ? rand(4, 9) : rand(7, 15);

    // Occasional slow days or closed days
    const skip = Math.random() < 0.05; // 5% chance of no sales that day
    const dayOrders = skip ? 0 : baseOrders;

    for (let o = 0; o < dayOrders; o++) {
      // Random hour 7am–8pm local time
      const hour = rand(7, 20);
      const minute = rand(0, 59);

      // Build the paid_at timestamp in UTC equivalent for the local date+time
      const paidAtStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      // Convert local time to UTC by using the offset (approximate — good enough for seed data)
      const paidAt = new Date(`${paidAtStr}`);

      // Pick 1–4 items
      const itemCount = rand(1, 4);
      const items: { product_id: number; quantity: number; price: number; cost: number }[] = [];
      for (let i = 0; i < itemCount; i++) {
        const p = pick(products);
        const qty = rand(1, 3);
        const existing = items.find(x => x.product_id === p.id);
        if (existing) {
          existing.quantity += qty;
        } else {
          items.push({ product_id: p.id, quantity: qty, price: p.price, cost: p.cost });
        }
      }

      const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
      const paymentMethod = Math.random() < 0.55 ? 'card' : 'cash';

      // Insert order
      const { rows: [order] } = await pool.query(
        `INSERT INTO orders (session_id, status, total, payment_method, paid_at, amount_received, change_due)
         VALUES ($1, 'paid', $2, $3, $4 AT TIME ZONE $5, $6, $7)
         RETURNING id`,
        [
          sessionId,
          total.toFixed(2),
          paymentMethod,
          paidAtStr,
          TZ,
          paymentMethod === 'cash' ? (total + rand(0, 5)) : null,
          null,
        ]
      );

      for (const it of items) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [order.id, it.product_id, it.quantity, it.price, it.cost, (it.price * it.quantity).toFixed(2)]
        );
      }

      // Ledger entry
      const account = paymentMethod === 'card' || paymentMethod === 'transfer' ? 'digital' : 'cash';
      await pool.query(
        `INSERT INTO ledger_entries (entry_type, account, amount, description, ref_id, ref_type, created_at)
         VALUES ('sale', $1, $2, $3, $4, 'order', $5 AT TIME ZONE $6)`,
        [account, total.toFixed(2), `Order #${order.id} paid with ${paymentMethod}`, order.id, paidAtStr, TZ]
      );

      ordersInserted++;
    }

    current = addDays(current, 1);
  }

  console.log(`Inserted ${ordersInserted} historical orders across ${Math.round((endDate.getTime() - startDate.getTime()) / 86400000)} days.`);
  await pool.end();
}

seedOrders().catch(err => { console.error(err); process.exit(1); });
