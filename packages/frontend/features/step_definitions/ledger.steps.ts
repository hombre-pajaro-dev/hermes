import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

Given('there is a paid order via the API with {string}', async function (this: PosWorld, productName: string) {
  const base = `${API}/api`;
  const sessionRes = await fetch(`${base}/register/session`);
  const session = await sessionRes.json() as { id?: number } | null;
  if (!session?.id) {
    await fetch(`${base}/register/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opening_cash: 200 }) });
  }
  const productRes = await fetch(`${base}/products?name=${encodeURIComponent(productName)}`);
  const product = await productRes.json() as { id: number };
  const orderRes = await fetch(`${base}/checkout/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ product_id: product.id, quantity: 1 }] }) });
  const order = await orderRes.json() as { id: number };
  await fetch(`${base}/checkout/orders/${order.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_method: 'card' }) });
});

Then('I see the ledger entries section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entries"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="ledger-entries"]').isVisible()).to.be.true;
});

When('I switch to the Balances tab', async function (this: PosWorld) {
  await this.page.click('.tabs-nav__item:nth-child(2)');
  await this.page.waitForLoadState('networkidle');
});

Then('I see the balances section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="balances"]', { timeout: 5000 });
});

Then('the cash account is visible', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="balance-cash"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

When('I expand the first sale entry', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entry"]', { timeout: 5000 });
  const entries = this.page.locator('[data-testid="ledger-entry"]');
  const count = await entries.count();
  for (let i = 0; i < count; i++) {
    const entry = entries.nth(i);
    const typeText = await entry.locator('.list-item__name').textContent();
    if (typeText?.includes('sale')) {
      await entry.locator('.list-item').click();
      await this.page.waitForLoadState('networkidle');
      break;
    }
  }
});

Then('I see item rows for that entry', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-item-row"]', { timeout: 5000 });
  const rows = await this.page.locator('[data-testid="ledger-item-row"]').count();
  expect(rows).to.be.greaterThan(0);
});

Then('I see the account adjustment form', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="account-adjustment-form"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="account-adjustment-form"]').isVisible()).to.be.true;
});

Then('the adjustment account selector is visible', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="adjustment-account-select"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('the adjustment submit button is visible', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="adjustment-submit-btn"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});
