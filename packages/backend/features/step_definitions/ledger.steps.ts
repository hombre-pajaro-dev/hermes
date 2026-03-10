import { When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

async function getProductByName(agent: PosWorld['agent'], name: string): Promise<{ id: number }> {
  const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
  return res.body as { id: number };
}

When('I fetch the ledger', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/ledger');
});

When('I fetch the account balances', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/ledger/balances');
});

When('I fetch the accounts list', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/ledger/accounts');
});

When('I record payroll of {float} from {string} with description {string}', async function (this: PosWorld, amount: number, account: string, description: string) {
  this.response = await this.agent.post('/api/ledger/payroll').send({ amount, account, description });
});

Then('there is a {string} ledger entry with account {string}', function (this: PosWorld, type: string, account: string) {
  const entries = this.response.body as { entry_type: string; account: string }[];
  const found = entries.some(e => e.entry_type === type && e.account === account);
  expect(found, `Expected a '${type}' entry with account '${account}'`).to.be.true;
});

Then('the sale entry has a non-zero amount', function (this: PosWorld) {
  const entries = this.response.body as { entry_type: string; amount: number }[];
  const sale = entries.find(e => e.entry_type === 'sale');
  expect(sale).to.exist;
  expect(sale!.amount).to.not.equal(0);
});

Then('the {string} account balance is positive', function (this: PosWorld, account: string) {
  const balances = this.response.body as { account: string; balance: number }[];
  const found = balances.find(b => b.account === account);
  expect(found, `Account '${account}' not found`).to.exist;
  expect(found!.balance).to.be.greaterThan(0);
});

Then('the {string} account is present in balances', function (this: PosWorld, account: string) {
  const balances = this.response.body as { account: string }[];
  const found = balances.some(b => b.account === account);
  expect(found, `Account '${account}' not present in balances`).to.be.true;
});

Then('there is a {string} ledger entry with amount {float}', function (this: PosWorld, type: string, amount: number) {
  const entries = this.response.body as { entry_type: string; amount: number }[];
  const found = entries.find(e => e.entry_type === type);
  expect(found, `Expected a '${type}' entry`).to.exist;
  expect(found!.amount).to.be.closeTo(amount, 0.001);
});

Then('the ledger payroll entry account is {string}', function (this: PosWorld, account: string) {
  const entries = this.response.body as { entry_type: string; account: string }[];
  const payroll = entries.find(e => e.entry_type === 'payroll');
  expect(payroll).to.exist;
  expect(payroll!.account).to.equal(account);
});

Then('the ledger entries are ordered by created_at descending', function (this: PosWorld) {
  const entries = this.response.body as { created_at: string }[];
  for (let i = 1; i < entries.length; i++) {
    expect(entries[i - 1].created_at >= entries[i].created_at,
      `Entry ${i - 1} (${entries[i-1].created_at}) should be >= entry ${i} (${entries[i].created_at})`
    ).to.be.true;
  }
});

Then('the accounts list includes {string}', function (this: PosWorld, name: string) {
  const accounts = this.response.body as { name: string }[];
  const found = accounts.some(a => a.name === name);
  expect(found, `Account '${name}' not found`).to.be.true;
});
