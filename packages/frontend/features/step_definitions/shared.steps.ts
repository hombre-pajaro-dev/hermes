import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

const ROUTES: Record<string, string> = {
  'Register': '/register',
  'Checkout': '/checkout',
  'Tabs': '/tabs',
  'Products': '/products',
  'Restock': '/restock',
  'Inventory': '/inventory',
  'Ledger': '/ledger',
  'Reports': '/reports',
};

Given('I am on the {word} page', async function (this: PosWorld, name: string) {
  await this.page.goto(`${this.baseUrl}${ROUTES[name]}`);
  await this.page.waitForLoadState('networkidle');
});

Given('the register is open via the API with {int}', async function (this: PosWorld, amount: number) {
  await fetch(`${API}/api/register/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opening_cash: amount }),
  });
});

Given('the register is closed via the API', async function (this: PosWorld) {
  const sessionRes = await fetch(`${API}/api/register/session`);
  const session = await sessionRes.json() as { id?: number } | null;
  if (session?.id) {
    await fetch(`${API}/api/register/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closing_cash: 0 }),
    });
  }
});

Then('I see a success message', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="success-banner"]', { timeout: 5000 });
  const text = await this.page.locator('[data-testid="success-banner"]').textContent();
  expect(text).to.not.be.empty;
});

Then('I see an error message', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="error-banner"]', { timeout: 5000 });
});
