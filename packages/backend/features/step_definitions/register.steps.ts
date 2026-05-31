import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I open the register with opening cash {float}', async function (this: PosWorld, amount: number) {
  this.response = await this.agent.post('/api/register/open').send({ opening_cash: amount });
  if (this.response.status === 201) this.context.sessionId = this.response.body.id;
});

When('I try to open the register with opening cash {float}', async function (this: PosWorld, amount: number) {
  this.response = await this.agent.post('/api/register/open').send({ opening_cash: amount });
});

When('I cash out {float} with reason {string}', async function (this: PosWorld, amount: number, reason: string) {
  this.response = await this.agent.post('/api/register/cashout').send({ amount, reason });
});

When('I close the register with closing cash {float}', async function (this: PosWorld, amount: number) {
  this.response = await this.agent.post('/api/register/close').send({ closing_cash: amount });
});

When('I close the register with closing cash {float} and physical count for {string} of {int}', async function (this: PosWorld, cash: number, productName: string, units: number) {
  const prodRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
  const product = prodRes.body as { id: number };
  this.response = await this.agent.post('/api/register/close').send({
    closing_cash: cash,
    physical_counts: [{ product_id: product.id, units }],
  });
});

When('I close the register with closing cash {float} and physical count matching system for {string}', async function (this: PosWorld, cash: number, productName: string) {
  const prodRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
  const product = prodRes.body as { id: number; units: number };
  this.response = await this.agent.post('/api/register/close').send({
    closing_cash: cash,
    physical_counts: [{ product_id: product.id, units: product.units }],
  });
});

Then('the session report has an adjustment for {string}', function (this: PosWorld, productName: string) {
  const body = this.response.body as { adjustments: { name: string }[] };
  const found = body.adjustments.some(a => a.name === productName);
  expect(found, `Expected adjustment for "${productName}" in session report`).to.be.true;
});

Then('the session report has no adjustments', function (this: PosWorld) {
  const body = this.response.body as { adjustments: unknown[] };
  expect(body.adjustments).to.be.an('array').that.is.empty;
});

When('I try to close the register without closing cash', async function (this: PosWorld) {
  this.response = await this.agent.post('/api/register/close').send({});
});

When('I try to close the register with closing cash {float}', async function (this: PosWorld, amount: number) {
  this.response = await this.agent.post('/api/register/close').send({ closing_cash: amount });
});

Then('the register status is {string}', async function (this: PosWorld, status: string) {
  if (status === 'open') {
    const res = await this.agent.get('/api/register/session');
    expect(res.body).to.have.property('status', 'open');
  } else {
    const body = this.response.body as { status: string };
    expect(body.status).to.equal(status);
  }
});

Then('the register opening cash is {float}', async function (this: PosWorld, amount: number) {
  const res = await this.agent.get('/api/register/session');
  expect(res.body.opening_cash).to.be.closeTo(amount, 0.001);
});

Then('the cashout is recorded with amount {float}', function (this: PosWorld, amount: number) {
  expect(this.response.status).to.equal(201);
  const body = this.response.body as { amount: number };
  expect(body.amount).to.be.closeTo(amount, 0.001);
});

Then('the close brief has a revenue field', async function (this: PosWorld) {
  const res = await this.agent.get('/api/reports/close-brief');
  expect(res.body).to.have.property('revenue');
});

Then('the close brief has a total_cost field', async function (this: PosWorld) {
  const res = await this.agent.get('/api/reports/close-brief');
  expect(res.body).to.have.property('total_cost');
});

When('I fetch the register sessions list', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/register/sessions');
});

When('I fetch the session report for the current session', async function (this: PosWorld) {
  const sessionId = this.context.sessionId as number;
  this.response = await this.agent.get(`/api/register/sessions/${sessionId}/report`);
});

When('I fetch the session report for the last session', async function (this: PosWorld) {
  const listRes = await this.agent.get('/api/register/sessions');
  const sessions = listRes.body as { id: number }[];
  const lastId = sessions[0]?.id;
  this.response = await this.agent.get(`/api/register/sessions/${lastId}/report`);
});

When('I open a new tab and pay it', async function (this: PosWorld) {
  const tabRes = await this.agent.post('/api/tabs').send({ name: 'Tab Session Test' });
  const tabId = tabRes.body.id as number;
  const prodRes = await this.agent.get('/api/products?name=Espresso');
  await this.agent.post(`/api/tabs/${tabId}/items`).send({ items: [{ product_id: prodRes.body.id, quantity: 1 }] });
  await this.agent.post(`/api/tabs/${tabId}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
});

Then('the sessions list is an array', function (this: PosWorld) {
  expect(this.response.body).to.be.an('array');
});

Then('the sessions list has at least {int} entry', function (this: PosWorld, min: number) {
  expect(this.response.body).to.have.length.at.least(min);
});

Then('the session report has order_count at least {int}', function (this: PosWorld, min: number) {
  const body = this.response.body as { order_count: number };
  expect(body.order_count).to.be.at.least(min);
});

Then('the session report has order_count of {int}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { order_count: number };
  expect(body.order_count).to.equal(expected);
});

Then('the session report has positive revenue', function (this: PosWorld) {
  const body = this.response.body as { revenue: number };
  expect(body.revenue).to.be.greaterThan(0);
});

Then('the session report has a by_item array', function (this: PosWorld) {
  const body = this.response.body as { by_item: unknown[] };
  expect(body.by_item).to.be.an('array');
});

Then('the session has an inventory_snapshot_open with products', function (this: PosWorld) {
  const body = this.response.body as { session: { inventory_snapshot_open: { products: unknown[] } | null } };
  expect(body.session.inventory_snapshot_open).to.not.be.null;
  expect(body.session.inventory_snapshot_open!.products).to.be.an('array').with.length.greaterThan(0);
});

Then('the session has an inventory_snapshot_close with products', function (this: PosWorld) {
  const body = this.response.body as { session: { inventory_snapshot_close: { products: unknown[] } | null } };
  expect(body.session.inventory_snapshot_close).to.not.be.null;
  expect(body.session.inventory_snapshot_close!.products).to.be.an('array').with.length.greaterThan(0);
});

Then('the session report expected_cash is {float}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { expected_cash: number };
  expect(body.expected_cash).to.be.closeTo(expected, 0.001);
});

Then('the session report cash_variance is {float}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { cash_variance: number };
  expect(body.cash_variance).to.be.closeTo(expected, 0.001);
});

Then('the session report transfer_sales is at least {float}', function (this: PosWorld, min: number) {
  const body = this.response.body as { transfer_sales: number };
  expect(body.transfer_sales, 'transfer_sales missing from session report').to.be.a('number');
  expect(body.transfer_sales).to.be.at.least(min);
});

Then('the session report expected_digital is positive', function (this: PosWorld) {
  const body = this.response.body as { expected_digital: number };
  expect(body.expected_digital, 'expected_digital missing from session report').to.be.a('number');
  expect(body.expected_digital).to.be.greaterThan(0);
});

When('I submit post-close reconciliation with physical count for {string} of {int}',
  async function (this: PosWorld, productName: string, units: number) {
    const sessRes = await this.agent.get('/api/register/sessions');
    const sessions = sessRes.body as { id: number; status: string }[];
    const last = sessions.find(s => s.status === 'closed') ?? sessions[0];
    const prodRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
    const product = prodRes.body as { id: number };
    this.response = await this.agent.patch(`/api/register/sessions/${last.id}/reconcile`)
      .send({ physical_counts: [{ product_id: product.id, units }] });
  }
);

When('I submit post-close reconciliation with actual digital {float}',
  async function (this: PosWorld, amount: number) {
    const sessRes = await this.agent.get('/api/register/sessions');
    const sessions = sessRes.body as { id: number; status: string }[];
    const last = sessions.find(s => s.status === 'closed') ?? sessions[0];
    this.response = await this.agent.patch(`/api/register/sessions/${last.id}/reconcile`)
      .send({ actual_digital: amount });
  }
);

Then('the session report actual_digital is {float}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { actual_digital: number };
  expect(body.actual_digital, 'actual_digital missing from session report').to.be.a('number');
  expect(body.actual_digital).to.be.closeTo(expected, 0.01);
});

Then('the session report has exactly {int} adjustment(s) for {string}',
  function (this: PosWorld, count: number, productName: string) {
    const body = this.response.body as { adjustments: { name: string }[] };
    const matching = body.adjustments.filter(a => a.name === productName);
    expect(matching.length, `Expected exactly ${count} adjustment(s) for "${productName}"`).to.equal(count);
  }
);

Then('the session report pnl net is positive', function (this: PosWorld) {
  const body = this.response.body as { pnl: { net: number } };
  expect(body.pnl, 'pnl missing from session report').to.exist;
  expect(body.pnl.net).to.be.greaterThan(0);
});

Then('the session report pnl revenue is at least {float}', function (this: PosWorld, min: number) {
  const body = this.response.body as { pnl: { revenue: number } };
  expect(body.pnl, 'pnl missing from session report').to.exist;
  expect(body.pnl.revenue).to.be.at.least(min);
});

Then('the session report pnl payroll is {float}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { pnl: { payroll: number } };
  expect(body.pnl, 'pnl missing from session report').to.exist;
  expect(body.pnl.payroll).to.be.closeTo(expected, 0.01);
});

Then('the session report active_products includes {string}', function (this: PosWorld, productName: string) {
  const body = this.response.body as { active_products: { name: string }[] };
  expect(body.active_products, 'active_products missing from session report').to.be.an('array');
  expect(body.active_products.some(p => p.name === productName),
    `Expected active_products to include "${productName}"`).to.be.true;
});
