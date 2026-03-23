import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I type {string} in the product search', async function (this: PosWorld, query: string) {
  await this.page.waitForSelector('[data-testid="product-search"]', { timeout: 5000 });
  await this.page.fill('[data-testid="product-search"]', query);
});

Then('only products matching {string} are shown', async function (this: PosWorld, name: string) {
  await this.page.locator(`[data-testid="add-${name.toLowerCase().replace(/\s+/g, '-')}"]`).waitFor({ timeout: 5000 });
  const visible = await this.page.locator('[data-testid^="add-"]').evaluateAll(
    els => els.filter(el => (el as HTMLElement).offsetParent !== null).length
  );
  expect(visible).to.be.greaterThan(0);
});

Then('products not matching are hidden', async function (this: PosWorld) {
  const total = await this.page.locator('[data-testid^="add-"]').count();
  const visible = await this.page.locator('[data-testid^="add-"]').evaluateAll(
    els => els.filter(el => (el as HTMLElement).offsetParent !== null).length
  );
  expect(visible).to.be.lessThan(total);
});

When('I switch checkout to grid view', async function (this: PosWorld) {
  await this.page.click('[data-testid="checkout-grid-view-btn"]');
});

When('I switch checkout to list view', async function (this: PosWorld) {
  await this.page.click('[data-testid="checkout-list-view-btn"]');
});

Then('I see the checkout product grid', async function (this: PosWorld) {
  await this.page.locator('[data-testid="checkout-products-grid"]').waitFor({ timeout: 5000 });
  expect(await this.page.locator('[data-testid="checkout-products-grid"]').isVisible()).to.be.true;
});

Then('I see the checkout product list', async function (this: PosWorld) {
  await this.page.locator('[data-testid="checkout-products-list"]').waitFor({ timeout: 5000 });
  expect(await this.page.locator('[data-testid="checkout-products-list"]').isVisible()).to.be.true;
});

When('I add {string} to the order', async function (this: PosWorld, name: string) {
  const testId = `add-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 5000 });
  await this.page.click(`[data-testid="${testId}"]`);
});

When('I select card payment', async function (this: PosWorld) {
  await this.page.click('[data-testid="pay-card-tab"]');
});

When('I select cash payment', async function (this: PosWorld) {
  await this.page.click('[data-testid="pay-cash-tab"]');
});

When('I enter cash received as {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="cash-received-input"]', String(amount));
});

When('I confirm payment', async function (this: PosWorld) {
  await this.page.click('[data-testid="confirm-payment-btn"]');
  await this.page.waitForLoadState('networkidle');
});

Then('I see a payment success message', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="payment-success"]', { timeout: 5000 });
});

Then('I see change due displayed', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="change-due"]');
  await el.waitFor({ timeout: 5000 });
  const text = await el.textContent();
  expect(text).to.match(/\$\d/);
});
