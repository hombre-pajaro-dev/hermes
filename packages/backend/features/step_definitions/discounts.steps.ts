import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number };
}

function discountStore(ctx: PosWorld['context']): Record<string, { id: number }> {
  if (!ctx._discounts) ctx._discounts = {};
  return ctx._discounts as Record<string, { id: number }>;
}

// ── Given ─────────────────────────────────────────────────────────────────────

Given('a {float}% discount named {string} exists', async function (this: PosWorld, pct: number, name: string) {
  const res = await this.agent.post('/api/discounts').send({
    name, type: 'percentage', value: pct, product_ids: [],
    is_manual: false, requires_pin: false,
  });
  expect(res.status).to.equal(201);
  discountStore(this.context)[name] = { id: res.body.id };
});

Given('a {float}% discount named {string} with max {int} redemptions exists', async function (
  this: PosWorld, pct: number, name: string, maxR: number,
) {
  const res = await this.agent.post('/api/discounts').send({
    name, type: 'percentage', value: pct, product_ids: [],
    is_manual: false, requires_pin: false, max_redemptions: maxR,
  });
  expect(res.status).to.equal(201);
  discountStore(this.context)[name] = { id: res.body.id };
});

Given('a buy {int} get {int} free discount on {string} named {string}', async function (
  this: PosWorld, buyQty: number, getQty: number, productName: string, name: string,
) {
  const product = await getProductByName(this.agent, productName);
  const res = await this.agent.post('/api/discounts').send({
    name, type: 'bxgy', buy_qty: buyQty, get_qty: getQty,
    product_ids: [product.id], is_manual: false, requires_pin: false,
  });
  expect(res.status).to.equal(201);
  discountStore(this.context)[name] = { id: res.body.id };
});

// ── When ──────────────────────────────────────────────────────────────────────

When('I create a {float}% discount named {string}', async function (this: PosWorld, pct: number, name: string) {
  this.response = await this.agent.post('/api/discounts').send({
    name, type: 'percentage', value: pct, product_ids: [],
    is_manual: false, requires_pin: false,
  });
  if (this.response.status === 201) discountStore(this.context)[name] = { id: this.response.body.id };
});

When('I delete the discount {string}', async function (this: PosWorld, name: string) {
  const id = discountStore(this.context)[name]?.id;
  if (!id) throw new Error(`Discount "${name}" not found in context`);
  this.response = await this.agent.delete(`/api/discounts/${id}`);
});

When('I pay the order with card and discount {string}', async function (this: PosWorld, name: string) {
  const orderId = this.context.orderId as number;
  const discountId = discountStore(this.context)[name]?.id;
  if (!discountId) throw new Error(`Discount "${name}" not found in context`);
  this.response = await this.agent
    .post(`/api/checkout/orders/${orderId}/pay`)
    .send({ payment_method: 'card', discount_id: discountId });
});

When('I pay the tab with card and discount {string}', async function (this: PosWorld, name: string) {
  const tabId = this.context.tabId as number;
  const discountId = discountStore(this.context)[name]?.id;
  if (!discountId) throw new Error(`Discount "${name}" not found in context`);
  this.response = await this.agent
    .post(`/api/tabs/${tabId}/pay`)
    .send({ payment_method: 'card', discount_id: discountId });
});

When('I try to pay the tab with discount {string}', async function (this: PosWorld, name: string) {
  const tabId = this.context.tabId as number;
  const discountId = discountStore(this.context)[name]?.id;
  if (!discountId) throw new Error(`Discount "${name}" not found in context`);
  this.response = await this.agent
    .post(`/api/tabs/${tabId}/pay`)
    .send({ payment_method: 'card', discount_id: discountId });
});

When('I open a new at-cost tab named {string}', async function (this: PosWorld, name: string) {
  this.response = await this.agent.post('/api/tabs').send({ name, at_cost: true });
  if (this.response.status === 201) this.context.tabId = this.response.body.id;
});

// ── Then ──────────────────────────────────────────────────────────────────────

Then('the discount response has type {string} and value {float}', function (this: PosWorld, type: string, value: number) {
  const body = this.response.body as { type: string; value: number };
  expect(body.type).to.equal(type);
  expect(body.value).to.be.closeTo(value, 0.001);
});

Then('the discount {string} is no longer listed', async function (this: PosWorld, name: string) {
  const res = await this.agent.get('/api/discounts');
  const discounts = res.body as { name: string }[];
  expect(discounts.some(d => d.name === name)).to.be.false;
});

Then('the order discount_amount is {float}', function (this: PosWorld, amount: number) {
  const body = this.response.body as { discount_amount: number };
  expect(body.discount_amount).to.be.closeTo(amount, 0.001);
});

Then('the tab discount_amount is {float}', function (this: PosWorld, amount: number) {
  const body = this.response.body as { discount_amount: number };
  expect(body.discount_amount).to.be.closeTo(amount, 0.001);
});

Then('the discount {string} has {int} redemption', async function (this: PosWorld, name: string, count: number) {
  const res = await this.agent.get('/api/discounts');
  const discounts = res.body as { name: string; redemptions: number }[];
  const found = discounts.find(d => d.name === name);
  expect(found, `Discount "${name}" not found`).to.exist;
  expect(found!.redemptions).to.equal(count);
});
