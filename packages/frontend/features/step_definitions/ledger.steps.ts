import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

Then('I see the ledger entries section', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="ledger-entries"]', { timeout: 5000 });
  expect(await this.page.locator('[data-testid="ledger-entries"]').isVisible()).to.be.true;
});

When('I switch to the Balances tab', async function (this: PosWorld) {
  await this.page.click('.tabs-nav__item:nth-child(2)');
  await this.page.waitForLoadState('networkidle');
});

When('I switch to the Payroll tab', async function (this: PosWorld) {
  await this.page.click('.tabs-nav__item:nth-child(3)');
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

When('I enter payroll amount {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="payroll-amount-input"]', String(amount));
});

When('I enter payroll description {string}', async function (this: PosWorld, desc: string) {
  await this.page.fill('[data-testid="payroll-desc-input"]', desc);
});

When('I click Record Payroll', async function (this: PosWorld) {
  await this.page.click('[data-testid="record-payroll-btn"]');
  await this.page.waitForLoadState('networkidle');
});
