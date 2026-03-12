"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
async function getProductByName(agent, name) {
    const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    return res.body;
}
(0, cucumber_1.When)('I open a new tab named {string}', async function (name) {
    this.response = await this.agent.post('/api/tabs').send({ name });
    if (this.response.status === 201)
        this.context.tabId = this.response.body.id;
});
(0, cucumber_1.When)('I add items to the tab', async function (table) {
    const rows = table.hashes();
    const items = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        return { product_id: p.id, quantity: Number(r.quantity) };
    }));
    const tabId = this.context.tabId;
    this.response = await this.agent.post(`/api/tabs/${tabId}/items`).send({ items });
});
(0, cucumber_1.When)('I request the tabs summary', async function () {
    this.response = await this.agent.get('/api/tabs/summary');
});
(0, cucumber_1.When)('I pay the tab with cash amount {float}', async function (amount) {
    const tabId = this.context.tabId;
    this.response = await this.agent.post(`/api/tabs/${tabId}/pay`).send({ payment_method: 'cash', amount_received: amount });
});
(0, cucumber_1.When)('I pay the tab with card', async function () {
    const tabId = this.context.tabId;
    this.response = await this.agent.post(`/api/tabs/${tabId}/pay`).send({ payment_method: 'card' });
});
(0, cucumber_1.Then)('the tab total is {float}', function (total) {
    const body = this.response.body;
    (0, chai_1.expect)(body.total).to.be.closeTo(total, 0.001);
});
(0, cucumber_1.Then)('the tab item count is {int}', function (count) {
    const body = this.response.body;
    (0, chai_1.expect)(body.item_count).to.equal(count);
});
(0, cucumber_1.Then)('the summary open count is at least {int}', function (minCount) {
    const body = this.response.body;
    (0, chai_1.expect)(body.open_count).to.be.at.least(minCount);
});
(0, cucumber_1.Then)('the summary total amount is at least {float}', function (minAmount) {
    const body = this.response.body;
    (0, chai_1.expect)(body.total_amount).to.be.at.least(minAmount);
});
(0, cucumber_1.Then)('the tab status is {string}', function (status) {
    const body = this.response.body;
    (0, chai_1.expect)(body.status).to.equal(status);
});
(0, cucumber_1.Then)('the tab payment method is {string}', function (method) {
    const body = this.response.body;
    (0, chai_1.expect)(body.payment_method).to.equal(method);
});
