import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from '@playwright/test';

export class PosWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:5173';
  data: Record<string, unknown> = {};

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(PosWorld);
