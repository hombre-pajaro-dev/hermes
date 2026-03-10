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
