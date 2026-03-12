"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
async function getProductByName(agent, name) {
    const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    return res.body;
}
(0, cucumber_1.Given)('I have sold items', async function (table) {
    const rows = table.hashes();
    for (const row of rows) {
        const p = await getProductByName(this.agent, row.product_name);
        const orderRes = await this.agent.post('/api/checkout/orders').send({
            items: [{ product_id: p.id, quantity: Number(row.quantity) }]
        });
        const payBody = { payment_method: row.payment };
        if (row.payment === 'cash')
            payBody.amount_received = 9999;
        await this.agent.post(`/api/checkout/orders/${orderRes.body.id}/pay`).send(payBody);
    }
});
(0, cucumber_1.When)('I fetch the sales by item report for today', async function () {
    const today = new Date().toISOString().slice(0, 10);
    this.response = await this.agent.get(`/api/reports/sales-by-item?date=${today}`);
});
(0, cucumber_1.When)('I fetch the sales by item report for {string}', async function (date) {
    this.response = await this.agent.get(`/api/reports/sales-by-item?date=${date}`);
});
(0, cucumber_1.When)('I fetch the daily total report for today', async function () {
    const today = new Date().toISOString().slice(0, 10);
    this.response = await this.agent.get(`/api/reports/daily-total?date=${today}`);
});
(0, cucumber_1.When)('I fetch the close brief', async function () {
    this.response = await this.agent.get('/api/reports/close-brief');
});
(0, cucumber_1.When)('I fetch the daily range from today to today', async function () {
    const today = new Date().toISOString().slice(0, 10);
    this.response = await this.agent.get(`/api/reports/daily-range?from=${today}&to=${today}`);
});
(0, cucumber_1.Then)('the report includes {string} with units_sold {int}', function (name, units) {
    const report = this.response.body;
    const item = report.find(r => r.name === name);
    (0, chai_1.expect)(item, `Expected report to include '${name}'`).to.exist;
    (0, chai_1.expect)(item.units_sold).to.equal(units);
});
(0, cucumber_1.Then)('the daily total has order_count at least {int}', function (min) {
    const body = this.response.body;
    (0, chai_1.expect)(body.order_count).to.be.at.least(min);
});
(0, cucumber_1.Then)('the daily total has positive total_sales', function () {
    const body = this.response.body;
    (0, chai_1.expect)(body.total_sales).to.be.greaterThan(0);
});
(0, cucumber_1.Then)('the daily total has positive total_cost', function () {
    const body = this.response.body;
    (0, chai_1.expect)(body.total_cost).to.be.greaterThan(0);
});
(0, cucumber_1.Then)('the close brief has revenue', function () {
    (0, chai_1.expect)(this.response.body).to.have.property('revenue');
});
(0, cucumber_1.Then)('the close brief has total_cost', function () {
    (0, chai_1.expect)(this.response.body).to.have.property('total_cost');
});
(0, cucumber_1.Then)('the close brief has most_sold', function () {
    (0, chai_1.expect)(this.response.body).to.have.property('most_sold');
});
(0, cucumber_1.Then)('the close brief has most_profitable', function () {
    (0, chai_1.expect)(this.response.body).to.have.property('most_profitable');
});
(0, cucumber_1.Then)('the close brief has by_item array', function () {
    const body = this.response.body;
    (0, chai_1.expect)(body.by_item).to.be.an('array');
});
(0, cucumber_1.Then)('the response has at least one day entry', function () {
    const body = this.response.body;
    (0, chai_1.expect)(body).to.be.an('array').with.length.at.least(1);
});
(0, cucumber_1.Then)('each day has date, revenue, cost, order_count fields', function () {
    const days = this.response.body;
    for (const day of days) {
        (0, chai_1.expect)(day).to.have.property('date');
        (0, chai_1.expect)(day).to.have.property('revenue');
        (0, chai_1.expect)(day).to.have.property('cost');
        (0, chai_1.expect)(day).to.have.property('order_count');
    }
});
