import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number; units: number; cost: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number; units: number; cost: number };
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

import { Given } from '@cucumber/cucumber';

Given('a provider named {string} exists', async function (this: PosWorld, name: string) {
  const res = await this.agent.post('/api/providers').send({ name });
  this.context.providerId = (res.body as { id: number }).id;
  this.context.providerName = name;
});

When('I submit a restock order with provider {string} from {string} and items with unit cost',
  async function (this: PosWorld, providerName: string, account: string, table: DataTable) {
    const rows = table.hashes() as { product_name: string; quantity: string; unit_cost: string }[];
    for (const row of rows) {
      const p = await getProductByName(this.agent, row.product_name);
      this.context[`initial_${row.product_name}`] = p.units;
      this.context[`initial_cost_${row.product_name}`] = p.units; // store for later checks
    }
    const items = await Promise.all(rows.map(async r => {
      const p = await getProductByName(this.agent, r.product_name);
      // Store the previous cost before restock
      this.context[`prev_cost_${r.product_name}`] = (p as { id: number; units: number; cost?: number }).cost;
      return { product_id: p.id, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost) };
    }));
    const provRes = await this.agent.get('/api/providers');
    const prov = (provRes.body as { id: number; name: string }[]).find(p => p.name === providerName);
    this.response = await this.agent.post('/api/restock').send({
      items,
      provider_id: prov?.id ?? null,
      payment_account: account,
    });
  }
);

Then('the restock response includes provider info', function (this: PosWorld) {
  const body = this.response.body as { provider_id?: number | null; payment_amount?: number | null; payment_account?: string | null };
  expect(body.provider_id, 'Expected provider_id in response').to.be.a('number');
  expect(body.payment_amount, 'Expected payment_amount in response').to.be.a('number');
  expect(body.payment_account, 'Expected payment_account in response').to.be.a('string');
});

Then('the ledger has a {string} entry with amount {float}', async function (this: PosWorld, type: string, amount: number) {
  const res = await this.agent.get('/api/ledger');
  const entries = res.body as { entry_type: string; amount: number }[];
  const found = entries.find(e => e.entry_type === type && Math.abs(e.amount - amount) < 0.01);
  expect(found, `Expected a '${type}' entry with amount ${amount}`).to.exist;
});

When('I fetch the providers list', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/providers');
});

Then('the providers list includes {string}', function (this: PosWorld, name: string) {
  const providers = this.response.body as { name: string }[];
  expect(providers.some(p => p.name === name), `Expected provider "${name}" in list`).to.be.true;
});

Then('the product {string} cost is updated to {float}', async function (this: PosWorld, name: string, expectedCost: number) {
  const product = await getProductByName(this.agent, name);
  expect(product.cost).to.be.closeTo(expectedCost, 0.001);
});

Then('the restock ledger items show previous_cost for {string}', async function (this: PosWorld, name: string) {
  const ledgerRes = await this.agent.get('/api/ledger');
  const entries = ledgerRes.body as { id: number; entry_type: string }[];
  const entry = entries.find(e => e.entry_type === 'restock');
  expect(entry, 'Expected a restock entry').to.exist;
  const itemsRes = await this.agent.get(`/api/ledger/entries/${entry!.id}/items`);
  const items = itemsRes.body as { name: string; unit_price: number; previous_cost: number | null }[];
  const item = items.find(i => i.name === name);
  expect(item, `Expected item '${name}'`).to.exist;
  expect(item!.previous_cost, 'Expected previous_cost to be set').to.not.be.null;
  expect(item!.previous_cost).to.not.equal(item!.unit_price);
});

Then('the restock ledger entry has items', async function (this: PosWorld) {
  const entries = this.response.body as { id: number; entry_type: string }[];
  const entry = entries.find(e => e.entry_type === 'restock');
  expect(entry, 'Expected a restock entry').to.exist;
  const res = await this.agent.get(`/api/ledger/entries/${entry!.id}/items`);
  expect(res.status).to.equal(200);
  expect(res.body).to.be.an('array').with.length.greaterThan(0);
  this.context.restockItems = res.body;
});

Then('the restock items include {string} with quantity {int}', function (this: PosWorld, name: string, qty: number) {
  const items = this.context.restockItems as { name: string; quantity: number }[];
  const item = items.find(i => i.name === name);
  expect(item, `Expected item '${name}'`).to.exist;
  expect(item!.quantity).to.equal(qty);
});

// ── Supply cost / combined restock (ADR 0004) ─────────────────────────────

async function getSupplyByName(agent: PosWorld['agent'], name: string): Promise<{ id: number; quantity: number; cost: number }> {
  const res = await agent.get('/api/supplies');
  const supplies = res.body as { id: number; name: string; quantity: number; cost: number }[];
  const found = supplies.find(s => s.name === name);
  if (!found) throw new Error(`Supply "${name}" not found`);
  return found;
}

Given('a supply {string} with unit {string} and quantity {int} exists', async function (this: PosWorld, name: string, unit: string, quantity: number) {
  const res = await this.agent.post('/api/supplies').send({ name, unit, quantity, cost: 0 });
  this.context[`initial_supply_${name}`] = (res.body as { quantity: number }).quantity;
});

Given('a product {string} using {int} {string} per unit exists', async function (this: PosWorld, productName: string, quantityPerUnit: number, supplyName: string) {
  const supply = await getSupplyByName(this.agent, supplyName);
  await this.agent.post('/api/products').send({
    name: productName,
    description: '',
    cost: 0,
    price: 5.00,
    supply_ingredients: [{ supply_id: supply.id, quantity_per_unit: quantityPerUnit }],
  });
});

When('I submit a restock order with supply items', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { supply_name: string; quantity: string; unit_cost: string }[];
  const supply_items = await Promise.all(rows.map(async r => {
    const s = await getSupplyByName(this.agent, r.supply_name);
    return { supply_id: s.id, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost) };
  }));
  this.response = await this.agent.post('/api/restock').send({ supply_items });
});

When('I submit a combined restock order with provider {string} from {string}',
  async function (this: PosWorld, providerName: string, account: string, table: DataTable) {
    const rows = table.hashes() as { kind: string; name: string; quantity: string; unit_cost: string }[];
    const items = [];
    const supply_items = [];
    for (const r of rows) {
      if (r.kind === 'product') {
        const p = await getProductByName(this.agent, r.name);
        items.push({ product_id: p.id, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost) });
      } else {
        const s = await getSupplyByName(this.agent, r.name);
        supply_items.push({ supply_id: s.id, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost) });
      }
    }
    const provRes = await this.agent.get('/api/providers');
    const prov = (provRes.body as { id: number; name: string }[]).find(p => p.name === providerName);
    this.response = await this.agent.post('/api/restock').send({
      items,
      supply_items,
      provider_id: prov?.id ?? null,
      payment_account: account,
    });
  }
);

Then('the supply {string} cost is updated to {float}', async function (this: PosWorld, name: string, expectedCost: number) {
  const supply = await getSupplyByName(this.agent, name);
  expect(supply.cost).to.be.closeTo(expectedCost, 0.001);
});

Then('the supply {string} quantity increased by {int}', async function (this: PosWorld, name: string, increase: number) {
  const initial = this.context[`initial_supply_${name}`] as number;
  const supply = await getSupplyByName(this.agent, name);
  expect(supply.quantity).to.equal(initial + increase);
});

Then('there is exactly one {string} ledger entry', async function (this: PosWorld, type: string) {
  const res = await this.agent.get('/api/ledger');
  const entries = res.body as { entry_type: string }[];
  expect(entries.filter(e => e.entry_type === type)).to.have.length(1);
});

Then('the restock ledger items include both {string} and {string}', async function (this: PosWorld, nameA: string, nameB: string) {
  const ledgerRes = await this.agent.get('/api/ledger');
  const entries = ledgerRes.body as { id: number; entry_type: string }[];
  const entry = entries.find(e => e.entry_type === 'restock');
  expect(entry, 'Expected a restock entry').to.exist;
  const itemsRes = await this.agent.get(`/api/ledger/entries/${entry!.id}/items`);
  const items = itemsRes.body as { name: string; item_type?: string }[];
  expect(items.some(i => i.name === nameA), `Expected item '${nameA}'`).to.be.true;
  expect(items.some(i => i.name === nameB), `Expected item '${nameB}'`).to.be.true;
});

When('I try to set the product {string} cost to {float}', async function (this: PosWorld, name: string, cost: number) {
  const p = await getProductByName(this.agent, name);
  this.response = await this.agent.patch(`/api/products/${p.id}/cost`).send({ cost });
});

Then('the session report supplies_restocked includes {string} with quantity {int}', async function (this: PosWorld, name: string, qty: number) {
  const sessionId = this.context.sessionId as number;
  const res = await this.agent.get(`/api/register/sessions/${sessionId}/report`);
  const suppliesRestocked = (res.body as { supplies_restocked: { name: string; quantity_restocked: number }[] }).supplies_restocked;
  const found = suppliesRestocked.find(s => s.name === name);
  expect(found, `Expected supplies_restocked to include '${name}'`).to.exist;
  expect(found!.quantity_restocked).to.equal(qty);
});
