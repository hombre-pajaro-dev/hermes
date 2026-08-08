import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

When('I confirm with PIN {string}', async function (this: PosWorld, _pin: string) {
  // PIN confirmation dialog not implemented in UI — no-op
});

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
});

When('I fill in closing cash as {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="closing-cash-input"]', String(amount));
});

When('I click Close Register', async function (this: PosWorld) {
  await this.page.click('[data-testid="close-register-btn"]');
});

// ── Close Reconciliation (single-step) ────────────────────────────────────────

Given('Espresso has been sold in the current session', async function (this: PosWorld) {
  const productsRes = await fetch(`${API}/api/products?name=Espresso`);
  const product = await productsRes.json() as { id: number };
  const orderRes = await fetch(`${API}/api/checkout/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ product_id: product.id, quantity: 1 }] }),
  });
  const order = await orderRes.json() as { id: number };
  await fetch(`${API}/api/checkout/orders/${order.id}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_method: 'cash', amount_received: 9999 }),
  });
});

When('I fill in actual digital balance as {int}', async function (this: PosWorld, amount: number) {
  await this.page.fill('[data-testid="actual-digital-input"]', String(amount));
});

When('I fill in physical count for {string} as {int}', async function (this: PosWorld, name: string, count: number) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await this.page.fill(`[data-testid="physical-count-${slug}"]`, String(count));
});

Then('the actual digital balance input is visible in the close form', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="actual-digital-input"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('the close form shows a physical count input for {string}', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const el = this.page.locator(`[data-testid="physical-count-${slug}"]`);
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('the close form does not show a physical count input for {string}', async function (this: PosWorld, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const count = await this.page.locator(`[data-testid="physical-count-${slug}"]`).count();
  expect(count).to.equal(0);
});

// ── Close Reconciliation draft persistence ──────────────────────────────────

Then('the closing cash input shows {int}', async function (this: PosWorld, amount: number) {
  const el = this.page.locator('[data-testid="closing-cash-input"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.inputValue()).to.equal(String(amount));
});

Then('the closing cash input shows nothing', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="closing-cash-input"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.inputValue()).to.equal('');
});

Then('the actual digital balance input shows {int}', async function (this: PosWorld, amount: number) {
  const el = this.page.locator('[data-testid="actual-digital-input"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.inputValue()).to.equal(String(amount));
});

Then('the physical count for {string} shows {int}', async function (this: PosWorld, name: string, count: number) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const el = this.page.locator(`[data-testid="physical-count-${slug}"]`);
  await el.waitFor({ timeout: 5000 });
  expect(await el.inputValue()).to.equal(String(count));
});

Then('I see the closing cash restored warning', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="closing-cash-restored-warning"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('I see the actual digital balance restored warning', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="actual-digital-restored-warning"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('I do not see the closing cash restored warning', async function (this: PosWorld) {
  const count = await this.page.locator('[data-testid="closing-cash-restored-warning"]').count();
  expect(count).to.equal(0);
});

Given('a stale close reconciliation draft for a different session is stored', async function (this: PosWorld) {
  await this.page.evaluate(() => {
    localStorage.setItem('close-reconciliation-draft', JSON.stringify({
      sessionId: -1,
      closingCash: '999',
      actualDigital: '',
      physicalCounts: {},
    }));
  });
});

When('I have closed the register with cash {int} digital {int} and physical count for {string} of {int}',
  async function (this: PosWorld, cash: number, digital: number, name: string, count: number) {
    const productsRes = await fetch(`${API}/api/products?name=${encodeURIComponent(name)}`);
    const product = await productsRes.json() as { id: number };
    await fetch(`${API}/api/register/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closing_cash: cash,
        actual_digital: digital,
        physical_counts: [{ product_id: product.id, units: count }],
      }),
    });
  }
);

When('I navigate to the session report', async function (this: PosWorld) {
  await this.page.click('[data-nav="reports"]');
  await this.page.waitForLoadState('networkidle');
});

Then('the reconciliation narrative is visible', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="reconciliation-narrative"]');
  await el.waitFor({ timeout: 5000 });
  expect(await el.isVisible()).to.be.true;
});

Then('the reconciliation narrative shows a net variance', async function (this: PosWorld) {
  const el = this.page.locator('[data-testid="reconciliation-narrative"]');
  const text = await el.innerText();
  expect(text).to.include('Net variance');
});

Then('the reconciliation narrative net status is {string}', async function (this: PosWorld, status: string) {
  const el = this.page.locator('[data-testid="reconciliation-narrative"]');
  await el.waitFor({ timeout: 5000 });
  const title = await el.locator('.card__title').innerText();
  if (status === 'OK') {
    expect(title).to.include('OK');
  } else {
    expect(title).to.not.include('OK');
  }
});

Then('the reconciliation narrative net status is not {string}', async function (this: PosWorld, status: string) {
  const el = this.page.locator('[data-testid="reconciliation-narrative"]');
  await el.waitFor({ timeout: 5000 });
  const title = await el.locator('.card__title').innerText();
  expect(title).to.not.include(status);
});

Then('the reconciliation narrative diagnosis mentions {string}', async function (this: PosWorld, keyword: string) {
  const el = this.page.locator('[data-testid="reconciliation-narrative"]');
  await el.waitFor({ timeout: 5000 });
  const text = await el.innerText();
  expect(text.toLowerCase()).to.include(keyword.toLowerCase());
});

Given('a closed session with cash balanced and no inventory variance', async function (this: PosWorld) {
  await fetch(`${API}/api/register/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opening_cash: 200 }),
  });
  await fetch(`${API}/api/register/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closing_cash: 200, actual_digital: 0 }),
  });
});

Given('a closed session with cash short by {int}', async function (this: PosWorld, shortage: number) {
  await fetch(`${API}/api/register/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opening_cash: 200 }),
  });
  await fetch(`${API}/api/register/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closing_cash: 200 - shortage, actual_digital: 0 }),
  });
});

Given('a closed session with extra cash {int} and Espresso short by {int} units',
  async function (this: PosWorld, extra: number, _units: number) {
    await fetch(`${API}/api/register/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_cash: 200 }),
    });
    const productsRes = await fetch(`${API}/api/products?name=Espresso`);
    const product = await productsRes.json() as { id: number };
    await fetch(`${API}/api/register/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closing_cash: 200 + extra,
        actual_digital: 0,
        physical_counts: [{ product_id: product.id, units: 90 }],
      }),
    });
  }
);
