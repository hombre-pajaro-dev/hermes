"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
async function getProductByName(agent, name) {
    const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    return res.body;
}
(0, cucumber_1.When)('I create an order with items', async function (table) {
    const rows = table.hashes();
    const items = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        return { product_id: p.id, quantity: Number(r.quantity) };
    }));
    this.response = await this.agent.post('/api/checkout/orders').send({ items });
    if (this.response.status === 201)
        this.context.orderId = this.response.body.id;
});
(0, cucumber_1.When)('I try to create an order with items', async function (table) {
    const rows = table.hashes();
    const items = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        return { product_id: p.id, quantity: Number(r.quantity) };
    }));
    this.response = await this.agent.post('/api/checkout/orders').send({ items });
});
(0, cucumber_1.When)('I pay the order with card', async function () {
    const orderId = this.context.orderId;
    this.response = await this.agent.post(`/api/checkout/orders/${orderId}/pay`).send({ payment_method: 'card' });
});
(0, cucumber_1.When)('I pay the order with cash amount {float}', async function (amount) {
    const orderId = this.context.orderId;
    this.response = await this.agent.post(`/api/checkout/orders/${orderId}/pay`).send({ payment_method: 'cash', amount_received: amount });
});
(0, cucumber_1.When)('I try to pay the order with cash amount {float}', async function (amount) {
    const orderId = this.context.orderId;
    this.response = await this.agent.post(`/api/checkout/orders/${orderId}/pay`).send({ payment_method: 'cash', amount_received: amount });
});
(0, cucumber_1.Then)('the order status is {string}', function (status) {
    const body = this.response.body;
    (0, chai_1.expect)(body.status).to.equal(status);
});
(0, cucumber_1.Then)('the change due is {float}', function (change) {
    const body = this.response.body;
    (0, chai_1.expect)(body.change_due).to.be.closeTo(change, 0.001);
});
(0, cucumber_1.Then)('the stock of {string} decreased by {int}', async function (name, decrease) {
    const product = await getProductByName(this.agent, name);
    const initialUnits = { Espresso: 100, Croissant: 50, Latte: 80 };
    const expected = initialUnits[name] - decrease;
    (0, chai_1.expect)(product.units).to.equal(expected);
});
