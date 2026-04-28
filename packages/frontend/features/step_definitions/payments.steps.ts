import { Given, When, Then } from '@cucumber/cucumber';
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

Given('a provider named {string} exists via the API', async function (this: PosWorld, name: string) {
  const base = `${API}/api`;
  const res = await fetch(`${base}/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const provider = await res.json() as { id: number; name: string };
  (this.context as { providerId?: number; providerName?: string }).providerId = provider.id;
  (this.context as { providerId?: number; providerName?: string }).providerName = provider.name;
});

When('I click the Payments tab', async function (this: PosWorld) {
  await this.page.click('button:has-text("Payments")');
  await this.page.waitForSelector('[data-testid="provider-payment-section"]', { timeout: 5000 });
});

Then('I see the provider payment section', async function (this: PosWorld) {
  const visible = await this.page.isVisible('[data-testid="provider-payment-section"]');
  expect(visible, 'Provider payment section should be visible').to.be.true;
  const hasPicker = await this.page.isVisible('[data-testid="provider-payment-select"]');
  expect(hasPicker, 'Provider selector should be visible').to.be.true;
  const hasAmount = await this.page.isVisible('[data-testid="provider-payment-amount"]');
  expect(hasAmount, 'Amount input should be visible').to.be.true;
});

When('I record an ad-hoc payment of {float} for provider {string} from {string}',
  async function (this: PosWorld, amount: number, providerName: string, _account: string) {
    await this.page.waitForSelector('[data-testid="provider-payment-select"]', { timeout: 5000 });
    // Select the provider by name
    await this.page.selectOption('[data-testid="provider-payment-select"]', { label: providerName });
    await this.page.fill('[data-testid="provider-payment-amount"]', String(amount));
    await this.page.click('[data-testid="provider-payment-submit"]');
    await this.page.waitForSelector('[data-testid="provider-payment-success"]', { timeout: 5000 });
    // Navigate to Entries tab to verify ledger
    await this.page.click('button:has-text("Entries")');
  }
);
