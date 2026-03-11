import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { PosWorld } from './world';

// Increase default step timeout to 15 seconds
setDefaultTimeout(15000);

let browserInstance: import('@playwright/test').Browser;

BeforeAll(async function () {
  browserInstance = await chromium.launch({ headless: true });

  // Ensure required test products exist
  const baseApi = 'http://localhost:3001/api';
  try {
    const productsRes = await fetch(`${baseApi}/products`);
    const existingProducts = await productsRes.json() as { id: number; name: string }[];
    const existingNames = existingProducts.map((p) => p.name);

    const requiredProducts = [
      { name: 'Espresso', description: 'Single shot espresso', cost: 0.50, price: 2.50, units: 100 },
      { name: 'Latte', description: 'Espresso with milk', cost: 0.80, price: 4.50, units: 100 },
      { name: 'Cappuccino', description: 'Espresso with foam', cost: 0.70, price: 3.75, units: 100 },
    ];

    for (const product of requiredProducts) {
      if (!existingNames.includes(product.name)) {
        await fetch(`${baseApi}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product),
        });
      }
    }
  } catch { /* backend may not be running */ }
});

AfterAll(async function () {
  await browserInstance?.close();
});

Before(async function (this: PosWorld) {
  this.browser = browserInstance;
  this.context = await this.browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    baseURL: this.baseUrl,
  });
  this.page = await this.context.newPage();

  // Reset backend state via API calls before each scenario
  const baseApi = 'http://localhost:3001/api';
  try {
    // Close any open tabs then close register to get clean state
    const tabsRes = await fetch(`${baseApi}/tabs`);
    const tabs = await tabsRes.json() as { id: number; status: string }[];
    for (const tab of tabs.filter(t => t.status === 'open')) {
      await fetch(`${baseApi}/tabs/${tab.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'cash', amount_received: 99999 }),
      });
    }
    const sessionRes = await fetch(`${baseApi}/register/session`);
    const session = await sessionRes.json() as { id?: number } | null;
    if (session?.id) {
      await fetch(`${baseApi}/register/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_cash: 0 }),
      });
    }
  } catch { /* backend may not be running in CI */ }
});

After(async function (this: PosWorld) {
  await this.context?.close();
});
