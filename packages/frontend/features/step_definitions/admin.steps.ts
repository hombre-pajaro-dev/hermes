import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I navigate to the {word} admin section', async function (this: PosWorld, section: string) {
  await this.page.click(`[data-testid="admin-section-${section.toLowerCase()}-btn"]`);
  await this.page.waitForLoadState('networkidle');
});

Then('I see the register status card', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="session-status"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="session-status"]').isVisible()).to.be.true;
});

Then('I see the discounts section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="admin-section-discounts-btn"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="admin-section-discounts-btn"]').isVisible()).to.be.true;
});

When('I open a new at-cost tab named {string}', async function (this: PosWorld, name: string) {
  await this.page.click('.tabs-nav__item:nth-child(2)');
  await this.page.waitForSelector('[data-testid="tab-name-input"]');
  await this.page.fill('[data-testid="tab-name-input"]', name);
  await this.page.check('[data-testid="at-cost-toggle"]');
  await this.page.click('[data-testid="open-tab-btn"]');
  await this.page.waitForLoadState('networkidle');
});
