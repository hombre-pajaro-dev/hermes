import { Given, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

Given(
  'a payment is recorded via the API for {string} amount {float} from {string} type {string}',
  async function (this: PosWorld, name: string, amount: number, account: string, type: string) {
    const base = `${API}/api`;

    // Ensure payee exists
    const payeesRes = await fetch(`${base}/payees`);
    let payees = await payeesRes.json() as { id: number; name: string }[];
    let payee = payees.find(p => p.name === name);
    if (!payee) {
      const createRes = await fetch(`${base}/payees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, source_account: account }),
      });
      payee = await createRes.json() as { id: number; name: string };
    }

    await fetch(`${base}/payments/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: [{ payee_id: payee.id, amount, source_account: account }],
      }),
    });
  }
);

Then('I see a payroll entry in the ledger', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entries"]', { timeout: 8000 });
  const text = await this.page.locator('[data-testid="ledger-entries"]').textContent();
  expect(text).to.include('payroll');
});

Then('I see an expense entry in the ledger', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entries"]', { timeout: 8000 });
  const text = await this.page.locator('[data-testid="ledger-entries"]').textContent();
  expect(text).to.include('expense');
});

Then('I see a savings transfer entry in the ledger', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entries"]', { timeout: 8000 });
  const text = await this.page.locator('[data-testid="ledger-entries"]').textContent();
  expect(text).to.include('savings transfer');
});
