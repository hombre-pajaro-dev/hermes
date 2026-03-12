import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { PosWorld } from './world';

setDefaultTimeout(15000);

const API = process.env.TEST_API_URL ?? 'http://localhost:3001';

const SEED_PRODUCTS = [
  { name: 'Espresso',   description: 'Single shot espresso',  cost: 0.50, price: 2.50, units: 100 },
  { name: 'Latte',      description: 'Espresso with milk',    cost: 0.80, price: 4.50, units: 100 },
  { name: 'Cappuccino', description: 'Espresso with foam',    cost: 0.70, price: 3.75, units: 100 },
];

let browserInstance: import('@playwright/test').Browser;

BeforeAll(async function () {
  browserInstance = await chromium.launch({ headless: true });
});

AfterAll(async function () {
  await browserInstance?.close();
});

Before(async function (this: PosWorld) {
  // Reset the test database to a clean state
  await fetch(`${API}/api/test/reset`, { method: 'POST' });

  // Seed required products
  for (const product of SEED_PRODUCTS) {
    await fetch(`${API}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
  }

  // Set up Playwright browser context
  this.browser = browserInstance;
  this.context = await this.browser.newContext({
    viewport: { width: 390, height: 844 },
    baseURL: this.baseUrl,
  });
  this.page = await this.context.newPage();
});

After(async function (this: PosWorld) {
  await this.context?.close();
});
