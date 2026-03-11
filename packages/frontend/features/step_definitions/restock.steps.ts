import { When, Then } from '@cucumber/cucumber';
import { PosWorld } from '../support/world';

When('I enter restock quantity {int} for {string}', async function (this: PosWorld, qty: number, name: string) {
  await this.page.waitForSelector('[data-testid="restock-form"]', { timeout: 5000 });
  const testId = `restock-qty-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.fill(`[data-testid="${testId}"]`, String(qty));
});

When('I click Submit Restock', async function (this: PosWorld) {
  await this.page.click('[data-testid="submit-restock-btn"]');
  await this.page.waitForLoadState('networkidle');
});
