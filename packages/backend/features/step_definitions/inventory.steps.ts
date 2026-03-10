import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number; units: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number; units: number };
}

When('I submit an inventory adjustment', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; physical_count: string }[];
  const adjustments = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    this.context[`prev_${r.product_name}`] = p.units;
    return { product_id: p.id, physical_count: Number(r.physical_count) };
  }));
  this.response = await this.agent.post('/api/inventory/adjust').send({ adjustments });
});

When('I try to submit an inventory adjustment', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; physical_count: string }[];
  const adjustments = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, physical_count: Number(r.physical_count) };
  }));
  this.response = await this.agent.post('/api/inventory/adjust').send({ adjustments });
});

Then('the product {string} units are now {int}', async function (this: PosWorld, name: string, units: number) {
  const product = await getProductByName(this.agent, name);
  expect(product.units).to.equal(units);
});

Then('the ledger has an {string} entry with negative delta', async function (this: PosWorld, type: string) {
  const res = await this.agent.get('/api/ledger');
  const entries = res.body as { entry_type: string; amount: number }[];
  const found = entries.find(e => e.entry_type === type && e.amount < 0);
  expect(found, `Expected a '${type}' entry with negative delta`).to.exist;
});

Then('the adjustment delta is positive', function (this: PosWorld) {
  const body = this.response.body as { adjustments: { delta: number }[] };
  expect(body.adjustments[0].delta).to.be.greaterThan(0);
});
