import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I GET /api/payees', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/payees');
});

Then('the response includes a payee named {string}', function (this: PosWorld, name: string) {
  const body = this.response.body as { name: string }[];
  expect(body.some(p => p.name === name), `Expected payee "${name}" in list`).to.be.true;
});

When('I POST /api/payees with name {string} type {string}', async function (this: PosWorld, name: string, type: string) {
  this.response = await this.agent.post('/api/payees').send({ name, type });
  if (this.response.status === 201) {
    (this.context as { payeeId?: number }).payeeId = (this.response.body as { id: number }).id;
  }
});

Given('there is a payee {string} of type {string}', async function (this: PosWorld, name: string, type: string) {
  const res = await this.agent.post('/api/payees').send({ name, type, source_account: 'cash' });
  (this.context as { payeeId?: number }).payeeId = (res.body as { id: number }).id;
});

When('I PATCH the payee with active false', async function (this: PosWorld) {
  const id = (this.context as { payeeId?: number }).payeeId;
  this.response = await this.agent.patch(`/api/payees/${id}`).send({ active: false });
});

Then('the payee {string} is inactive', async function (this: PosWorld, name: string) {
  const res = await this.agent.get('/api/payees');
  const payees = res.body as { name: string; active: boolean }[];
  const payee = payees.find(p => p.name === name);
  expect(payee, `Payee "${name}" not found`).to.exist;
  expect(payee!.active).to.be.false;
});

When('I POST /api/payments/run with the payee amount {float} from {string}',
  async function (this: PosWorld, amount: number, account: string) {
    const id = (this.context as { payeeId?: number }).payeeId;
    this.response = await this.agent.post('/api/payments/run').send({
      entries: [{ payee_id: id, amount, source_account: account }],
    });
  }
);

When('I PATCH the payee default_weight to {float}', async function (this: PosWorld, weight: number) {
  const id = (this.context as { payeeId?: number }).payeeId;
  this.response = await this.agent.patch(`/api/payees/${id}`).send({ default_weight: weight });
});

Then('the payee {string} has default_weight {float}', async function (this: PosWorld, name: string, weight: number) {
  const res = await this.agent.get('/api/payees');
  const payees = res.body as { name: string; default_weight: number }[];
  const payee = payees.find(p => p.name === name);
  expect(payee, `Payee "${name}" not found`).to.exist;
  expect(Number(payee!.default_weight)).to.be.closeTo(weight, 0.01);
});

When('I POST /api/payments/run with the payee amount {float} from {string} and note {string}',
  async function (this: PosWorld, amount: number, account: string, note: string) {
    const id = (this.context as { payeeId?: number }).payeeId;
    this.response = await this.agent.post('/api/payments/run').send({
      entries: [{ payee_id: id, amount, source_account: account }],
      note,
    });
  }
);

Then('a ledger entry exists for {string} with amount {float} and type {string}',
  async function (this: PosWorld, description: string, amount: number, type: string) {
    const res = await this.agent.get('/api/ledger');
    const entries = res.body as { description: string; amount: number; entry_type: string }[];
    const found = entries.find(e => e.description === description && Math.abs(e.amount - amount) < 0.01 && e.entry_type === type);
    expect(found, `Expected ledger entry for "${description}" amount ${amount} type ${type}`).to.exist;
  }
);
