import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

Then('the register status shows as closed', async function (this: PosWorld) {
  const el = await this.page.locator('[data-testid="status-closed"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('the register shows as open', async function (this: PosWorld) {
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const badge = this.page.locator('.badge--open').first();
  await badge.waitFor({ timeout: 5000 });
  expect(await badge.isVisible()).to.be.true;
});

Then('the register shows as closed', async function (this: PosWorld) {
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const badge = this.page.locator('[data-testid="status-closed"]');
  await badge.waitFor({ timeout: 5000 });
  expect(await badge.isVisible()).to.be.true;
});

Then('the open register form is not visible', async function (this: PosWorld) {
  const form = this.page.locator('[data-testid="opening-cash-input"]');
  expect(await form.count()).to.equal(0);
});

Then('the close register button is disabled', async function (this: PosWorld) {
  const btn = this.page.locator('[data-testid="close-register-btn"]');
  await btn.waitFor({ timeout: 5000 });
  expect(await btn.isDisabled()).to.be.true;
});

When('I fill in opening cash as {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="opening-cash-input"]', String(amount));
});

When('I click Open Register', async function (this: PosWorld) {
  await this.page.click('[data-testid="open-register-btn"]');
  await this.page.waitForLoadState('networkidle');
});

When('I fill in cashout amount as {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="cashout-amount-input"]', String(amount));
});

When('I fill in cashout reason as {string}', async function (this: PosWorld, reason: string) {
  await this.page.fill('[data-testid="cashout-reason-input"]', reason);
});

When('I click Cash Out', async function (this: PosWorld) {
  await this.page.click('[data-testid="cashout-btn"]');
  await this.page.waitForLoadState('networkidle');
});

When('I fill in closing cash as {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="closing-cash-input"]', String(amount));
});

When('I click Close Register', async function (this: PosWorld) {
  await this.page.click('[data-testid="close-register-btn"]');
  await this.page.waitForLoadState('networkidle');
});
