import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number; units: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number; units: number };
}

When('I create an order with items', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string }[];
  const items = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, quantity: Number(r.quantity) };
  }));
  this.response = await this.agent.post('/api/checkout/orders').send({ items });
  if (this.response.status === 201) this.context.orderId = this.response.body.id;
});

When('I try to create an order with items', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string }[];
  const items = await Promise.all(rows.map(async r => {
    const p = await getProductByName(this.agent, r.product_name);
    return { product_id: p.id, quantity: Number(r.quantity) };
  }));
  this.response = await this.agent.post('/api/checkout/orders').send({ items });
});

When('I pay the order with card', async function (this: PosWorld) {
  const orderId = this.context.orderId as number;
  this.response = await this.agent.post(`/api/checkout/orders/${orderId}/pay`).send({ payment_method: 'card' });
});

When('I pay the order with cash amount {float}', async function (this: PosWorld, amount: number) {
  const orderId = this.context.orderId as number;
  this.response = await this.agent.post(`/api/checkout/orders/${orderId}/pay`).send({ payment_method: 'cash', amount_received: amount });
});

When('I try to pay the order with cash amount {float}', async function (this: PosWorld, amount: number) {
  const orderId = this.context.orderId as number;
  this.response = await this.agent.post(`/api/checkout/orders/${orderId}/pay`).send({ payment_method: 'cash', amount_received: amount });
});

Then('the order status is {string}', function (this: PosWorld, status: string) {
  const body = this.response.body as { status: string };
  expect(body.status).to.equal(status);
});

Then('the change due is {float}', function (this: PosWorld, change: number) {
  const body = this.response.body as { change_due: number };
  expect(body.change_due).to.be.closeTo(change, 0.001);
});

Then('the stock of {string} decreased by {int}', async function (this: PosWorld, name: string, decrease: number) {
  const product = await getProductByName(this.agent, name);
  const initialUnits: Record<string, number> = { Espresso: 100, Croissant: 50, Latte: 80 };
  const expected = initialUnits[name] - decrease;
  expect(product.units).to.equal(expected);
});
