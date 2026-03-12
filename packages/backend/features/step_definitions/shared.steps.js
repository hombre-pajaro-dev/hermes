"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
// ── Register setup steps (shared across all features) ────────────
(0, cucumber_1.Given)('the register is open with opening cash {float}', async function (amount) {
    const sessionRes = await this.agent.get('/api/register/session');
    if (sessionRes.body && sessionRes.body.id) {
        const tabsRes = await this.agent.get('/api/tabs');
        for (const tab of tabsRes.body) {
            if (tab.status === 'open') {
                await this.agent.post(`/api/tabs/${tab.id}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
            }
        }
        await this.agent.post('/api/register/close').send({ closing_cash: 0 });
    }
    const res = await this.agent.post('/api/register/open').send({ opening_cash: amount });
    this.context.sessionId = res.body.id;
});
(0, cucumber_1.Given)('the register is closed', async function () {
    const sessionRes = await this.agent.get('/api/register/session');
    if (sessionRes.body && sessionRes.body.id) {
        const tabsRes = await this.agent.get('/api/tabs');
        for (const tab of tabsRes.body) {
            if (tab.status === 'open') {
                await this.agent.post(`/api/tabs/${tab.id}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
            }
        }
        await this.agent.post('/api/register/close').send({ closing_cash: 0 });
    }
});
// ── Shared ledger step ────────────────────────────────────────────
(0, cucumber_1.Then)('the ledger has a {string} entry', async function (type) {
    const res = await this.agent.get('/api/ledger');
    const entries = res.body;
    const found = entries.some(e => e.entry_type === type);
    (0, chai_1.expect)(found, `Expected ledger to have a '${type}' entry`).to.be.true;
});
// ── Generic response assertions ───────────────────────────────────
(0, cucumber_1.Then)('the response status is {int}', function (status) {
    (0, chai_1.expect)(this.response.status).to.equal(status);
});
(0, cucumber_1.Then)('the response error mentions {string}', function (text) {
    const body = this.response.body;
    (0, chai_1.expect)(body.error ?? '').to.include(text);
});
