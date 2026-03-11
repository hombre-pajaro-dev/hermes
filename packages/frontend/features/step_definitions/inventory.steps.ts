import { When } from '@cucumber/cucumber';
import { PosWorld } from '../support/world';

When('I set physical count for {string} to {int}', async function (this: PosWorld, name: string, count: number) {
  await this.page.waitForSelector('[data-testid="inventory-form"]', { timeout: 5000 });
  const testId = `physical-count-${name.toLowerCase().replace(/\s+/g, '-')}`;
  await this.page.fill(`[data-testid="${testId}"]`, String(count));
});

When('I click Apply Adjustment', async function (this: PosWorld) {
  await this.page.click('[data-testid="submit-adjustment-btn"]');
  await this.page.waitForLoadState('networkidle');
});
