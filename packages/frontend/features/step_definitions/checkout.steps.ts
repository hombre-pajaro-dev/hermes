import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I add {string} to the order', async function (this: PosWorld, name: string) {
  const testId = `add-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 5000 });
  await this.page.click(`[data-testid="${testId}"]`);
});

When('I click Proceed to Payment', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="create-order-btn"]', { timeout: 5000 });
  await this.page.click('[data-testid="create-order-btn"]');
  await this.page.waitForLoadState('networkidle');
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
