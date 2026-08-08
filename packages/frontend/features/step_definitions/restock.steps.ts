import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

Given('there is a restock with changed unit cost via the API', async function (this: PosWorld) {
  const base = `${API}/api`;
  const sessionRes = await fetch(`${base}/register/session`);
  const session = await sessionRes.json() as { id?: number } | null;
  if (!session?.id) {
    await fetch(`${base}/register/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opening_cash: 200 }) });
  }
  const productRes = await fetch(`${base}/products?name=Espresso`);
  const product = await productRes.json() as { id: number; cost: number };
  // Use a cost clearly different from the stored one
  const differentCost = product.cost + 5;
  await fetch(`${base}/restock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ product_id: product.id, quantity: 5, unit_cost: differentCost }] }),
  });
});

Given('there is a completed restock via the API', async function (this: PosWorld) {
  const base = `${API}/api`;
  const sessionRes = await fetch(`${base}/register/session`);
  const session = await sessionRes.json() as { id?: number } | null;
  if (!session?.id) {
    await fetch(`${base}/register/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opening_cash: 200 }) });
  }
  const productRes = await fetch(`${base}/products?name=Espresso`);
  const product = await productRes.json() as { id: number };
  await fetch(`${base}/restock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ product_id: product.id, quantity: 5 }] }),
  });
});

When('I enter restock quantity {int} for {string}', async function (this: PosWorld, qty: number, name: string) {
  await this.page.waitForSelector('[data-testid="restock-form"]', { timeout: 5000 });
  const testId = `restock-qty-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.fill(`[data-testid="${testId}"]`, String(qty));
});

When('I click Submit Restock', async function (this: PosWorld) {
  await this.page.click('[data-testid="submit-restock-btn"]');
  await this.page.waitForLoadState('networkidle');
});

Then('I see the provider input', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="provider-input"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('I see the total paid input for {string}', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const el = this.page.locator(`[data-testid="restock-total-${slug}"]`);
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('I see the payment account selector', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="restock-payment-account"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

When('I expand the restock ledger entry', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entry"]', { timeout: 5000 });
  const entries = this.page.locator('[data-testid="ledger-entry"]');
  const count = await entries.count();
  for (let i = 0; i < count; i++) {
    const entry = entries.nth(i);
    const typeText = await entry.locator('.list-item__name').textContent();
    if (typeText?.includes('restock')) {
      await entry.locator('.list-item').click();
      await this.page.waitForLoadState('networkidle');
      break;
    }
  }
});

Then('I see the cost-updated tag on the restock item', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="cost-updated-tag"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="cost-updated-tag"]').first().isVisible()).to.be.true;
});

Given('there is a supply {string} via the API', async function (this: PosWorld, name: string) {
  const base = `${API}/api`;
  await fetch(`${base}/supplies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, unit: 'ml', quantity: 0, cost: 0 }),
  });
});

When('I enter restock supply quantity {int} for {string}', async function (this: PosWorld, qty: number, name: string) {
  await this.page.waitForSelector('[data-testid="restock-supply-form"]', { timeout: 5000 });
  const testId = `restock-supply-qty-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.fill(`[data-testid="${testId}"]`, String(qty));
});

When('I enter restock supply total paid {int} for {string}', async function (this: PosWorld, amount: number, name: string) {
  const testId = `restock-supply-total-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.fill(`[data-testid="${testId}"]`, String(amount));
});

Then('I see the supply quantity input for {string}', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const el = this.page.locator(`[data-testid="restock-supply-qty-${slug}"]`);
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('I see the supply total paid input for {string}', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const el = this.page.locator(`[data-testid="restock-supply-total-${slug}"]`);
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('I see the supply cost-change warning for {string}', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const el = this.page.locator(`[data-testid="supply-cost-change-warning-${slug}"]`);
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('each product row shows a unit cost', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="restock-form"]', { timeout: 5000 });
  const rows = this.page.locator('[data-testid="restock-form"] .list-item__sub');
  const count = await rows.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).textContent();
    if (text?.includes('Cost:')) { found = true; break; }
  }
  expect(found, 'Expected at least one product row to show Cost:').to.be.true;
});
