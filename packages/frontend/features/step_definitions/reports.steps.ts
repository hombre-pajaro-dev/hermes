import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

Then('I see the sales by item section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="sales-by-item"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="sales-by-item"]').isVisible()).to.be.true;
});

When('I switch to the Range tab', async function (this: PosWorld) {
  await this.page.click('.tabs-nav__item:nth-child(2)');
  await this.page.waitForLoadState('networkidle');
});

When('I switch to the Brief tab', async function (this: PosWorld) {
  await this.page.click('.tabs-nav__item:nth-child(3)');
  await this.page.waitForLoadState('networkidle');
});

When('I click Apply on the date range filter', async function (this: PosWorld) {
  await this.page.click('[data-testid="date-range-apply-btn"]');
  await this.page.waitForLoadState('networkidle');
});

Then('I see the date range apply button', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="date-range-apply-btn"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="date-range-apply-btn"]').isVisible()).to.be.true;
});

Then('I see datetime inputs on the By Item tab', async function (this: PosWorld) {
  const inputs = this.page.locator('input[type="datetime-local"]');
  expect(await inputs.count()).to.be.at.least(2);
});

Then('I see the daily total section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="daily-total"]', { timeout: 8000 });
  expect(await this.page.locator('[data-testid="daily-total"]').isVisible()).to.be.true;
});

Then('I see the range report section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="daily-range"]', { timeout: 8000 });
  expect(await this.page.locator('[data-testid="daily-range"]').isVisible()).to.be.true;
});

Then('I see the close brief section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="close-brief"]', { timeout: 8000 });
  expect(await this.page.locator('[data-testid="close-brief"]').isVisible()).to.be.true;
});

Then('I see the cash sales stat', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="cash-sales"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="cash-sales"]').isVisible()).to.be.true;
});

Then('I see the card sales stat', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="card-sales"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="card-sales"]').isVisible()).to.be.true;
});

When('I switch to the Sessions tab', async function (this: PosWorld) {
  await this.page.click('button:has-text("Sessions")');
  await this.page.waitForLoadState('networkidle');
});

Then('I see the session selector', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="session-selector"]', { timeout: 8000 });
  expect(await this.page.locator('[data-testid="session-selector"]').isVisible()).to.be.true;
});

Then('I see the session tab notice', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="session-tab-notice"]', { timeout: 8000 });
  expect(await this.page.locator('[data-testid="session-tab-notice"]').isVisible()).to.be.true;
});
