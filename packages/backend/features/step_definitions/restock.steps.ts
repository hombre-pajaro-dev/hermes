import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number; units: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number; units: number };
}

When('I submit a restock order with items', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string }[];
  // Store initial units
  for (const row of rows) {
    const p = await getProductByName(this.agent, row.product_name);
    this.context[`initial_${row.product_name}`] = p.units;
  }
  const items = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, quantity: Number(r.quantity) };
  }));
  this.response = await this.agent.post('/api/restock').send({ items });
});

When('I try to submit a restock order with items', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string }[];
  const items = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, quantity: Number(r.quantity) };
  }));
  this.response = await this.agent.post('/api/restock').send({ items });
});

Then('the product {string} units increased by {int}', async function (this: PosWorld, name: string, increase: number) {
  const initialUnits: Record<string, number> = { Espresso: 100, Croissant: 50, Latte: 80 };
  const product = await getProductByName(this.agent, name);
  expect(product.units).to.equal(initialUnits[name] + increase);
});

Then('the product {string} units remain at {int}', async function (this: PosWorld, name: string, units: number) {
  const product = await getProductByName(this.agent, name);
  expect(product.units).to.equal(units);
});
