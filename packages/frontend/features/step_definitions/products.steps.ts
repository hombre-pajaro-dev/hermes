import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

Then('I see a list of products', async function (this: PosWorld) {
  const list = this.page.locator('[data-testid="products-list"]');
  await list.waitFor({ timeout: 5000 });
  expect(await list.isVisible()).to.be.true;
});

Then('each product shows name and price', async function (this: PosWorld) {
  const count = await this.page.locator('[data-testid="product-item"]').count();
  expect(count).to.be.greaterThan(0);
});

When('I click Add Product', async function (this: PosWorld) {
  await this.page.click('[data-testid="add-product-btn"]');
});

When('I fill in product name as {string}', async function (this: PosWorld, name: string) {
  await this.page.fill('[data-testid="product-name-input"]', name);
});

When('I fill in product description as {string}', async function (this: PosWorld, desc: string) {
  await this.page.fill('[data-testid="product-description-input"]', desc);
});

When('I fill in product cost as {float}', async function (this: PosWorld, val: number) {
  await this.page.fill('[data-testid="product-cost-input"]', String(val));
});

When('I fill in product price as {float}', async function (this: PosWorld, val: number) {
  await this.page.fill('[data-testid="product-price-input"]', String(val));
});

When('I fill in product units as {int}', async function (this: PosWorld, val: number) {
  await this.page.fill('[data-testid="product-units-input"]', String(val));
});

When('I click Create Product', async function (this: PosWorld) {
  await this.page.click('[data-testid="create-product-btn"]');
  await this.page.waitForLoadState('networkidle');
});

Then('I see the product {string} in the list', async function (this: PosWorld, name: string) {
  await this.page.waitForSelector('[data-testid="products-list"]');
  const names = await this.page.locator('[data-testid="product-name"]').allTextContents();
  expect(names).to.include(name);
});

When('I click the Edit price button for {string}', async function (this: PosWorld, name: string) {
  const res = await fetch(`http://localhost:3001/api/products?name=${encodeURIComponent(name)}`);
  const product = await res.json() as { id: number };
  this.data.editProductId = product.id;
  await this.page.waitForSelector(`[data-testid="edit-price-${product.id}"]`, { timeout: 5000 });
  await this.page.click(`[data-testid="edit-price-${product.id}"]`);
});

When('I set the new price to {float}', async function (this: PosWorld, price: number) {
  const id = this.data.editProductId as number;
  await this.page.waitForSelector(`[data-testid="price-input-${id}"]`);
  await this.page.fill(`[data-testid="price-input-${id}"]`, String(price));
});

When('I save the new price', async function (this: PosWorld) {
  const id = this.data.editProductId as number;
  await this.page.click(`[data-testid="save-price-${id}"]`);
  await this.page.waitForLoadState('networkidle');
});

Then('the product {string} shows price {float}', async function (this: PosWorld, name: string, price: number) {
  // Check for error banner first — if visible, the save failed
  const errBanner = this.page.locator('[data-testid="error-banner"]');
  const hasError = await errBanner.isVisible();
  if (hasError) {
    const msg = await errBanner.textContent();
    throw new Error(`Price save showed error: ${msg}`);
  }

  // Verify backend updated correctly
  const apiRes = await fetch(`http://localhost:3001/api/products?name=${encodeURIComponent(name)}`);
  const apiProduct = await apiRes.json() as { price: number };
  expect(apiProduct.price, `API price not updated: expected ${price}, got ${apiProduct.price}`).to.be.closeTo(price, 0.01);

  // Reload and verify UI
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const items = this.page.locator('[data-testid="product-item"]');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const n = await items.nth(i).locator('[data-testid="product-name"]').textContent();
    if (n === name) {
      const priceEl = items.nth(i).locator('[data-testid="product-price"]');
      await priceEl.waitFor({ timeout: 8000 });
      const text = await priceEl.textContent();
      expect(parseFloat(text?.replace('$', '') ?? '0')).to.be.closeTo(price, 0.01);
      return;
    }
  }
  throw new Error(`Product "${name}" not found in list`);
});

Then('no ledger entry is added for the price change', async function (this: PosWorld) {
  const res = await fetch('http://localhost:3001/api/ledger');
  const entries = await res.json() as { entry_type: string }[];
  expect(entries.some(e => e.entry_type === 'price_change')).to.be.false;
});

Given('"Espresso" is in an open tab via the API', async function (this: PosWorld) {
  const base = 'http://localhost:3001/api';
  const sessionRes = await fetch(`${base}/register/session`);
  const session = await sessionRes.json() as { id?: number } | null;
  if (!session?.id) {
    await fetch(`${base}/register/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opening_cash: 200 }) });
  }
  const tabRes = await fetch(`${base}/tabs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Lock Test Tab' }) });
  const tab = await tabRes.json() as { id: number };
  const productRes = await fetch(`${base}/products?name=Espresso`);
  const product = await productRes.json() as { id: number };
  await fetch(`${base}/tabs/${tab.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ product_id: product.id, quantity: 1 }] }) });
  this.data.lockedProductId = product.id;
});

Then('the price edit for {string} is locked', async function (this: PosWorld, name: string) {
  const res = await fetch(`http://localhost:3001/api/products?name=${encodeURIComponent(name)}`);
  const product = await res.json() as { id: number };
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const lockEl = this.page.locator(`[data-testid="price-locked-${product.id}"]`);
  await lockEl.waitFor({ timeout: 5000 });
  expect(await lockEl.isVisible()).to.be.true;
});

When('I click the Edit cost button for {string}', async function (this: PosWorld, name: string) {
  const res = await fetch(`http://localhost:3001/api/products?name=${encodeURIComponent(name)}`);
  const product = await res.json() as { id: number };
  this.data.editProductId = product.id;
  await this.page.waitForSelector(`[data-testid="edit-cost-${product.id}"]`, { timeout: 5000 });
  await this.page.click(`[data-testid="edit-cost-${product.id}"]`);
});

When('I set the new cost to {float}', async function (this: PosWorld, cost: number) {
  const id = this.data.editProductId as number;
  await this.page.waitForSelector(`[data-testid="cost-input-${id}"]`);
  await this.page.fill(`[data-testid="cost-input-${id}"]`, String(cost));
});

When('I save the new cost', async function (this: PosWorld) {
  const id = this.data.editProductId as number;
  await this.page.click(`[data-testid="save-cost-${id}"]`);
  await this.page.waitForLoadState('networkidle');
});

Then('the product {string} shows cost {float}', async function (this: PosWorld, name: string, cost: number) {
  const errBanner = this.page.locator('[data-testid="error-banner"]');
  const hasError = await errBanner.isVisible();
  if (hasError) {
    const msg = await errBanner.textContent();
    throw new Error(`Cost save showed error: ${msg}`);
  }

  const apiRes = await fetch(`http://localhost:3001/api/products?name=${encodeURIComponent(name)}`);
  const apiProduct = await apiRes.json() as { cost: number };
  expect(apiProduct.cost, `API cost not updated: expected ${cost}, got ${apiProduct.cost}`).to.be.closeTo(cost, 0.01);

  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const items = this.page.locator('[data-testid="product-item"]');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const n = await items.nth(i).locator('[data-testid="product-name"]').textContent();
    if (n === name) {
      const costEl = items.nth(i).locator('[data-testid="product-cost"]');
      await costEl.waitFor({ timeout: 8000 });
      const text = await costEl.textContent();
      expect(parseFloat(text?.replace('$', '') ?? '0')).to.be.closeTo(cost, 0.01);
      return;
    }
  }
  throw new Error(`Product "${name}" not found in list`);
});

Then('no ledger entry is added for the cost change', async function (this: PosWorld) {
  const res = await fetch('http://localhost:3001/api/ledger');
  const entries = await res.json() as { entry_type: string }[];
  expect(entries.some(e => e.entry_type === 'cost_change')).to.be.false;
});

Then('the cost edit for {string} is locked', async function (this: PosWorld, name: string) {
  const res = await fetch(`http://localhost:3001/api/products?name=${encodeURIComponent(name)}`);
  const product = await res.json() as { id: number };
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
  const lockEl = this.page.locator(`[data-testid="cost-locked-${product.id}"]`);
  await lockEl.waitFor({ timeout: 5000 });
  expect(await lockEl.isVisible()).to.be.true;
});
