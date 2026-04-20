import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number };
}

When('I open a new tab named {string}', async function (this: PosWorld, name: string) {
  this.response = await this.agent.post('/api/tabs').send({ name });
  if (this.response.status === 201) this.context.tabId = this.response.body.id;
});

When('I add items to the tab', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string }[];
  const items = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, quantity: Number(r.quantity) };
  }));
  const tabId = this.context.tabId as number;
  this.response = await this.agent.post(`/api/tabs/${tabId}/items`).send({ items });
});

When('I update the tab item {string} to quantity {int}', async function (this: PosWorld, productName: string, quantity: number) {
  const tabId = this.context.tabId as number;
  const tabRes = await this.agent.get(`/api/tabs/${tabId}`);
  const tab = tabRes.body as { items: { id: number; product_id: number }[] };
  const product = await getProductByName(this.agent, productName);
  const item = tab.items.find((i: { id: number; product_id: number }) => i.product_id === product.id);
  if (!item) throw new Error(`Item for product ${productName} not found on tab`);
  this.response = await this.agent.patch(`/api/tabs/${tabId}/items/${item.id}`).send({ quantity });
});

When('I try to add items to the tab exceeding stock', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string }[];
  const items = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, quantity: Number(r.quantity) };
  }));
  const tabId = this.context.tabId as number;
  this.response = await this.agent.post(`/api/tabs/${tabId}/items`).send({ items });
});

When('I void the tab', async function (this: PosWorld) {
  const tabId = this.context.tabId as number;
  this.response = await this.agent.post(`/api/tabs/${tabId}/void`);
});

When('I request the tabs summary', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/tabs/summary');
});

When('I pay the tab with cash amount {float}', async function (this: PosWorld, amount: number) {
  const tabId = this.context.tabId as number;
  this.response = await this.agent.post(`/api/tabs/${tabId}/pay`).send({ payment_method: 'cash', amount_received: amount });
});

When('I pay the tab with card', async function (this: PosWorld) {
  const tabId = this.context.tabId as number;
  this.response = await this.agent.post(`/api/tabs/${tabId}/pay`).send({ payment_method: 'card' });
});

Then('the tab total is {float}', function (this: PosWorld, total: number) {
  const body = this.response.body as { total: number };
  expect(body.total).to.be.closeTo(total, 0.001);
});

Then('the tab item count is {int}', function (this: PosWorld, count: number) {
  const body = this.response.body as { item_count: number };
  expect(body.item_count).to.equal(count);
});

Then('the summary open count is at least {int}', function (this: PosWorld, minCount: number) {
  const body = this.response.body as { open_count: number };
  expect(body.open_count).to.be.at.least(minCount);
});

Then('the summary total amount is at least {float}', function (this: PosWorld, minAmount: number) {
  const body = this.response.body as { total_amount: number };
  expect(body.total_amount).to.be.at.least(minAmount);
});

Then('the tab status is {string}', function (this: PosWorld, status: string) {
  const body = this.response.body as { status: string };
  expect(body.status).to.equal(status);
});

Then('the tab payment method is {string}', function (this: PosWorld, method: string) {
  const body = this.response.body as { payment_method: string };
  expect(body.payment_method).to.equal(method);
});

When('I fetch the tabs list', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/tabs');
});

Then('each tab in the list has an items array', function (this: PosWorld) {
  const tabs = this.response.body as { items: unknown[] }[];
  expect(tabs).to.be.an('array').with.length.greaterThan(0);
  for (const tab of tabs) {
    expect(tab).to.have.property('items').that.is.an('array');
  }
});

Then('the tab named {string} has items with product names', function (this: PosWorld, name: string) {
  const tabs = this.response.body as { name: string; items: { name: string; quantity: number }[] }[];
  const tab = tabs.find(t => t.name === name);
  expect(tab, `Expected tab named "${name}" in tabs list`).to.exist;
  expect(tab!.items.length).to.be.greaterThan(0);
  expect(tab!.items[0]).to.have.property('name').that.is.a('string');
});
