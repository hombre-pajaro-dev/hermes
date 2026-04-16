import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

Given('a {float}% discount named {string} is seeded via the API', async function (
  this: PosWorld, pct: number, name: string,
) {
  await fetch(`${API}/api/discounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      type: 'percentage',
      value: pct,
      product_ids: [],
      is_manual: false,
      requires_pin: false,
    }),
  });
});

Then('I see the discount banner', async function (this: PosWorld) {
  await this.page.locator('[data-testid="discount-banner"]').waitFor({ timeout: 6000 });
  expect(await this.page.locator('[data-testid="discount-banner"]').isVisible()).to.be.true;
});

When('I remove the discount', async function (this: PosWorld) {
  await this.page.locator('[data-testid="remove-discount-btn"]').waitFor({ timeout: 6000 });
  await this.page.click('[data-testid="remove-discount-btn"]');
});

Then('the discount banner is not visible', async function (this: PosWorld) {
  // Give it a moment to react
  await this.page.waitForTimeout(500);
  const count = await this.page.locator('[data-testid="discount-banner"]').count();
  expect(count).to.equal(0);
});

Then('the receipt shows a discount line', async function (this: PosWorld) {
  await this.page.locator('[data-testid="receipt-discount"]').waitFor({ timeout: 6000 });
  const text = await this.page.locator('[data-testid="receipt-discount"]').textContent();
  expect(text).to.match(/−\$\d/);
});
