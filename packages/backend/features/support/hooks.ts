import { Before } from '@cucumber/cucumber';
import { resetDb, getDb } from '../../src/db/database';

Before(async function () {
  await resetDb();
  const db = await getDb();
  await db.query(
    "INSERT INTO products (name, description, cost, price, units) VALUES ('Espresso', 'Single shot', 0.80, 3.00, 100)"
  );
  await db.query(
    "INSERT INTO products (name, description, cost, price, units) VALUES ('Croissant', 'Butter croissant', 1.20, 4.50, 50)"
  );
  await db.query(
    "INSERT INTO products (name, description, cost, price, units) VALUES ('Latte', 'Milk coffee', 1.50, 5.00, 80)"
  );
});
