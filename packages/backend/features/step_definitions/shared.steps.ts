import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

// ── Register setup steps (shared across all features) ────────────

Given('the register is open with opening cash {float}', async function (this: PosWorld, amount: number) {
  const sessionRes = await this.agent.get('/api/register/session');
  if (sessionRes.body && sessionRes.body.id) {
    const tabsRes = await this.agent.get('/api/tabs');
    for (const tab of (tabsRes.body as { id: number; status: string }[])) {
      if (tab.status === 'open') {
        await this.agent.post(`/api/tabs/${tab.id}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
      }
    }
    await this.agent.post('/api/register/close').send({ closing_cash: 0 });
  }
  const res = await this.agent.post('/api/register/open').send({ opening_cash: amount });
  this.context.sessionId = res.body.id;
});

Given('the register is closed', async function (this: PosWorld) {
  const sessionRes = await this.agent.get('/api/register/session');
  if (sessionRes.body && sessionRes.body.id) {
    const tabsRes = await this.agent.get('/api/tabs');
    for (const tab of (tabsRes.body as { id: number; status: string }[])) {
      if (tab.status === 'open') {
        await this.agent.post(`/api/tabs/${tab.id}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
      }
    }
    await this.agent.post('/api/register/close').send({ closing_cash: 0 });
  }
});

// ── Shared ledger step ────────────────────────────────────────────

Then('the ledger has no {string} entry', async function (this: PosWorld, type: string) {
  const res = await this.agent.get('/api/ledger');
  const entries = res.body as { entry_type: string }[];
  const found = entries.some(e => e.entry_type === type);
  expect(found, `Expected ledger to have no '${type}' entry, but one was found`).to.be.false;
});

Then('the ledger has a {string} entry', async function (this: PosWorld, type: string) {
  const res = await this.agent.get('/api/ledger');
  const entries = res.body as { entry_type: string }[];
  const found = entries.some(e => e.entry_type === type);
  expect(found, `Expected ledger to have a '${type}' entry`).to.be.true;
});

// ── Generic response assertions ───────────────────────────────────

Then('the response status is {int}', function (this: PosWorld, status: number) {
  expect(this.response.status).to.equal(status);
});

Then('the response error mentions {string}', function (this: PosWorld, text: string) {
  const body = this.response.body as { error?: string };
  expect(body.error ?? '').to.include(text);
});
