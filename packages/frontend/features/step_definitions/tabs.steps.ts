import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

Given('there is an open tab via the API named {string}', async function (this: PosWorld, name: string) {
  const base = `${API}/api`;
  const sessionRes = await fetch(`${base}/register/session`);
  const session = await sessionRes.json() as { id?: number } | null;
  if (!session?.id) {
    await fetch(`${base}/register/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opening_cash: 200 }) });
  }
  const tabRes = await fetch(`${base}/tabs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  const tab = await tabRes.json() as { id: number };
  const espressoRes = await fetch(`${base}/products?name=Espresso`);
  const espresso = await espressoRes.json() as { id: number };
  await fetch(`${base}/tabs/${tab.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ product_id: espresso.id, quantity: 1 }] }) });
  (this as PosWorld & { tabId?: number; tabName?: string }).tabId = tab.id;
  (this as PosWorld & { tabId?: number; tabName?: string }).tabName = name;
});

When('I open a new tab named {string}', async function (this: PosWorld, name: string) {
  await this.page.click('.tabs-nav__item:nth-child(2)'); // "+ New Tab"
  await this.page.waitForSelector('[data-testid="tab-name-input"]');
  await this.page.fill('[data-testid="tab-name-input"]', name);
  await this.page.click('[data-testid="open-tab-btn"]');
  await this.page.waitForLoadState('networkidle');
});

When('I add {string} to the tab', async function (this: PosWorld, name: string) {
  const testId = `tab-add-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 10000 });
  await this.page.click(`[data-testid="${testId}"]`);
  await this.page.waitForLoadState('networkidle');
});

When('I view the tab {string}', async function (this: PosWorld, _name: string) {
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const self = this as PosWorld & { tabId?: number };
  const tabId = self.tabId;
  if (tabId) {
    await this.page.click(`[data-testid="view-tab-${tabId}"]`);
  }
});

When('I pay the tab with card', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="pay-card-btn"]', { timeout: 5000 });
  await this.page.click('[data-testid="pay-card-btn"]');
  await this.page.waitForLoadState('networkidle');
});

Then('the tab total is greater than 0', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="tab-total"]', { timeout: 10000 });
  await this.page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="tab-total"]');
    if (!el) return false;
    const text = el.textContent ?? '';
    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
    return amount > 0;
  }, { timeout: 10000 });
  const text = await this.page.locator('[data-testid="tab-total"]').textContent();
  const amount = parseFloat(text?.replace(/[^0-9.]/g, '') ?? '0');
  expect(amount).to.be.greaterThan(0);
});

Then('the open tab count is at least {int}', async function (this: PosWorld, min: number) {
  await this.page.waitForSelector('[data-testid="open-tab-count"]', { timeout: 5000 });
  const text = await this.page.locator('[data-testid="open-tab-count"]').textContent();
  expect(Number(text)).to.be.at.least(min);
});

Then('the stock count for {string} is visible in Add Items', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await this.page.waitForSelector(`[data-testid="tab-product-stock-${slug}"]`, { timeout: 10000 });
  const text = await this.page.locator(`[data-testid="tab-product-stock-${slug}"]`).textContent();
  expect(text).to.match(/in stock|out of stock/);
});

When('I increase the quantity of {string} on the tab', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await this.page.waitForSelector(`[data-testid="tab-item-increase-${slug}"]`, { timeout: 10000 });
  await this.page.click(`[data-testid="tab-item-increase-${slug}"]`);
  await this.page.waitForLoadState('networkidle');
});

When('I decrease the quantity of {string} on the tab to zero', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await this.page.waitForSelector(`[data-testid="tab-item-decrease-${slug}"]`, { timeout: 10000 });
  await this.page.click(`[data-testid="tab-item-decrease-${slug}"]`);
  await this.page.waitForLoadState('networkidle');
});

Then('the tab items section is empty', async function (this: PosWorld) {
  await this.page.locator('[data-testid="tab-items-empty"]').waitFor({ timeout: 8000 });
  expect(await this.page.locator('[data-testid="tab-items-empty"]').isVisible()).to.be.true;
});

Then('I see the close tab button', async function (this: PosWorld) {
  await this.page.locator('[data-testid="void-tab-btn"]').waitFor({ timeout: 8000 });
  expect(await this.page.locator('[data-testid="void-tab-btn"]').isVisible()).to.be.true;
});

When('I close the empty tab with PIN {string}', async function (this: PosWorld, pin: string) {
  await this.page.click('[data-testid="void-tab-btn"]');
  await this.page.waitForSelector('[data-testid="pin-input"]', { timeout: 5000 });
  await this.page.fill('[data-testid="pin-input"]', pin);
  await this.page.click('[data-testid="pin-confirm-btn"]');
  await this.page.waitForLoadState('networkidle');
});

Then('I see the tabs list', async function (this: PosWorld) {
  await this.page.locator('[data-testid="open-tab-count"]').waitFor({ timeout: 5000 });
  expect(await this.page.locator('[data-testid="open-tab-count"]').isVisible()).to.be.true;
});

Then('the tab items summary for {string} is visible', async function (this: PosWorld, _name: string) {
  const self = this as PosWorld & { tabId?: number };
  const tabId = self.tabId;
  const testId = `tab-items-summary-${tabId}`;
  await this.page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 8000 });
  expect(await this.page.locator(`[data-testid="${testId}"]`).isVisible()).to.be.true;
});

Then('I see an updated timestamp in the tab list', async function (this: PosWorld) {
  const self = this as PosWorld & { tabId?: number };
  const tabId = self.tabId;
  await this.page.waitForSelector(`[data-testid="view-tab-${tabId}"]`, { timeout: 8000 });
  const row = this.page.locator('[data-testid="tab-item"]').filter({ has: this.page.locator(`[data-testid="view-tab-${tabId}"]`) });
  const text = await row.textContent();
  expect(text).to.include('Updated');
});

Then('I see an updated timestamp in the tab detail', async function (this: PosWorld) {
  await this.page.waitForSelector('[data-testid="tab-total"]', { timeout: 8000 });
  const card = this.page.locator('[data-testid="tab-total"]').locator('..');
  const text = await card.textContent();
  expect(text).to.include('Updated');
});
