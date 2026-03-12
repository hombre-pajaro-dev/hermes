import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I fill in current PIN as {string}', async function (this: PosWorld, pin: string) {
  await this.page.fill('[data-testid="current-pin-input"]', pin);
});

When('I fill in new PIN as {string}', async function (this: PosWorld, pin: string) {
  await this.page.fill('[data-testid="new-pin-input"]', pin);
});

When('I fill in confirm PIN as {string}', async function (this: PosWorld, pin: string) {
  await this.page.fill('[data-testid="confirm-pin-input"]', pin);
});

When('I click Change PIN', async function (this: PosWorld) {
  await this.page.click('[data-testid="change-pin-btn"]');
  await this.page.waitForLoadState('networkidle');
});

When('I confirm with PIN {string}', async function (this: PosWorld, pin: string) {
  await this.page.waitForSelector('[data-testid="pin-input"]');
  await this.page.fill('[data-testid="pin-input"]', pin);
  await this.page.click('[data-testid="pin-confirm-btn"]');
  await this.page.waitForLoadState('networkidle');
});

When('I enter PIN {string} in the modal', async function (this: PosWorld, pin: string) {
  await this.page.waitForSelector('[data-testid="pin-input"]');
  await this.page.fill('[data-testid="pin-input"]', pin);
  await this.page.click('[data-testid="pin-confirm-btn"]');
});

When('I open a new at-cost tab named {string}', async function (this: PosWorld, name: string) {
  await this.page.click('.tabs-nav__item:nth-child(2)');
  await this.page.waitForSelector('[data-testid="tab-name-input"]');
  await this.page.fill('[data-testid="tab-name-input"]', name);
  await this.page.check('[data-testid="at-cost-toggle"]');
  await this.page.click('[data-testid="open-tab-btn"]');
});

Then('I see a PIN error message', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="pin-error"]', { timeout: 5000 });
  const text = await this.page.locator('[data-testid="pin-error"]').textContent();
  expect(text).to.not.be.empty;
});
