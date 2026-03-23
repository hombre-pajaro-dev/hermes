import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number };
}

Given('I have sold items', async function (this: PosWorld, table: DataTable) {
  const rows = table.hashes() as { product_name: string; quantity: string; payment: string }[];
  for (const row of rows) {
    const p = await getProductByName(this.agent, row.product_name);
    const orderRes = await this.agent.post('/api/checkout/orders').send({
      items: [{ product_id: p.id, quantity: Number(row.quantity) }]
    });
    const payBody: Record<string, unknown> = { payment_method: row.payment };
    if (row.payment === 'cash') payBody.amount_received = 9999;
    await this.agent.post(`/api/checkout/orders/${orderRes.body.id}/pay`).send(payBody);
  }
});

When('I fetch the sales by item report for today', async function (this: PosWorld) {
  const today = new Date().toISOString().slice(0, 10);
  this.response = await this.agent.get(`/api/reports/sales-by-item?date=${today}`);
});

When('I fetch the sales by item report for {string}', async function (this: PosWorld, date: string) {
  this.response = await this.agent.get(`/api/reports/sales-by-item?date=${date}`);
});

When('I fetch the daily total report for today', async function (this: PosWorld) {
  const today = new Date().toISOString().slice(0, 10);
  this.response = await this.agent.get(`/api/reports/daily-total?date=${today}`);
});

When('I fetch the close brief', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/reports/close-brief');
});

When('I fetch the daily range from today to today', async function (this: PosWorld) {
  const today = new Date().toISOString().slice(0, 10);
  this.response = await this.agent.get(`/api/reports/daily-range?from=${today}&to=${today}`);
});

Then('the report includes {string} with units_sold {int}', function (this: PosWorld, name: string, units: number) {
  const report = this.response.body as { name: string; units_sold: number }[];
  const item = report.find(r => r.name === name);
  expect(item, `Expected report to include '${name}'`).to.exist;
  expect(item!.units_sold).to.equal(units);
});

Then('the daily total has order_count at least {int}', function (this: PosWorld, min: number) {
  const body = this.response.body as { order_count: number };
  expect(body.order_count).to.be.at.least(min);
});

Then('the daily total has positive total_sales', function (this: PosWorld) {
  const body = this.response.body as { total_sales: number };
  expect(body.total_sales).to.be.greaterThan(0);
});

Then('the daily total has positive total_cost', function (this: PosWorld) {
  const body = this.response.body as { total_cost: number };
  expect(body.total_cost).to.be.greaterThan(0);
});

Then('the daily total has cash_sales greater than {int}', function (this: PosWorld, min: number) {
  const body = this.response.body as { cash_sales: number };
  expect(Number(body.cash_sales)).to.be.greaterThan(min);
});

Then('the daily total has card_sales greater than {int}', function (this: PosWorld, min: number) {
  const body = this.response.body as { card_sales: number };
  expect(Number(body.card_sales)).to.be.greaterThan(min);
});

Then('the close brief has revenue', function (this: PosWorld) {
  expect(this.response.body).to.have.property('revenue');
});

Then('the close brief has total_cost', function (this: PosWorld) {
  expect(this.response.body).to.have.property('total_cost');
});

Then('the close brief has most_sold', function (this: PosWorld) {
  expect(this.response.body).to.have.property('most_sold');
});

Then('the close brief has most_profitable', function (this: PosWorld) {
  expect(this.response.body).to.have.property('most_profitable');
});

Then('the close brief has by_item array', function (this: PosWorld) {
  const body = this.response.body as { by_item: unknown };
  expect(body.by_item).to.be.an('array');
});

Then('the response has at least one day entry', function (this: PosWorld) {
  const body = this.response.body as unknown[];
  expect(body).to.be.an('array').with.length.at.least(1);
});

Then('each day has date, revenue, cost, order_count fields', function (this: PosWorld) {
  const days = this.response.body as Record<string, unknown>[];
  for (const day of days) {
    expect(day).to.have.property('date');
    expect(day).to.have.property('revenue');
    expect(day).to.have.property('cost');
    expect(day).to.have.property('order_count');
  }
});
