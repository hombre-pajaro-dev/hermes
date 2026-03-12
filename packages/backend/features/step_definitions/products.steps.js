"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
(0, cucumber_1.When)('I fetch all products', async function () {
    this.response = await this.agent.get('/api/products');
});
(0, cucumber_1.When)('I fetch the product named {string}', async function (name) {
    this.response = await this.agent.get(`/api/products?name=${encodeURIComponent(name)}`);
});
(0, cucumber_1.When)('I create a product with name {string} description {string} cost {float} price {float} units {int}', async function (name, description, cost, price, units) {
    this.response = await this.agent.post('/api/products').send({ name, description, cost, price, units });
});
(0, cucumber_1.Then)('the response is a non-empty array', function () {
    (0, chai_1.expect)(this.response.body).to.be.an('array').with.length.greaterThan(0);
});
(0, cucumber_1.Then)('the response is an array', function () {
    (0, chai_1.expect)(this.response.body).to.be.an('array');
});
(0, cucumber_1.Then)('each product has fields id, name, description, cost, price, units', function () {
    const products = this.response.body;
    for (const p of products) {
        (0, chai_1.expect)(p).to.have.property('id');
        (0, chai_1.expect)(p).to.have.property('name');
        (0, chai_1.expect)(p).to.have.property('description');
        (0, chai_1.expect)(p).to.have.property('cost');
        (0, chai_1.expect)(p).to.have.property('price');
        (0, chai_1.expect)(p).to.have.property('units');
    }
});
(0, cucumber_1.Then)('the product name is {string}', function (name) {
    const body = this.response.body;
    (0, chai_1.expect)(body.name).to.equal(name);
});
(0, cucumber_1.Then)('the product cost is {float}', function (cost) {
    const body = this.response.body;
    (0, chai_1.expect)(body.cost).to.be.closeTo(cost, 0.001);
});
(0, cucumber_1.Then)('the product price is {float}', function (price) {
    const body = this.response.body;
    (0, chai_1.expect)(body.price).to.be.closeTo(price, 0.001);
});
(0, cucumber_1.Then)('the product has a units field', function () {
    (0, chai_1.expect)(this.response.body).to.have.property('units');
});
(0, cucumber_1.Then)('the product units is {int}', function (units) {
    const body = this.response.body;
    (0, chai_1.expect)(body.units).to.equal(units);
});
(0, cucumber_1.When)('I update the price of {string} to {float}', async function (name, price) {
    const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    const product = productRes.body;
    this.response = await this.agent.patch(`/api/products/${product.id}/price`).send({ price });
});
(0, cucumber_1.Then)('no ledger entry is created for the price change', async function () {
    const res = await this.agent.get('/api/ledger');
    const entries = res.body;
    const hasPriceEntry = entries.some(e => e.entry_type === 'price_change');
    (0, chai_1.expect)(hasPriceEntry).to.be.false;
});
(0, cucumber_1.When)('I update the cost of {string} to {float}', async function (name, cost) {
    const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    const product = productRes.body;
    this.response = await this.agent.patch(`/api/products/${product.id}/cost`).send({ cost });
});
(0, cucumber_1.Then)('no ledger entry is created for the cost change', async function () {
    const res = await this.agent.get('/api/ledger');
    const entries = res.body;
    (0, chai_1.expect)(entries.some(e => e.entry_type === 'cost_change')).to.be.false;
});
(0, cucumber_1.Given)('a product {string} is added to an open tab', async function (name) {
    const tabRes = await this.agent.post('/api/tabs').send({ name: 'Test Tab' });
    const tabId = tabRes.body.id;
    const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    const product = productRes.body;
    await this.agent.post(`/api/tabs/${tabId}/items`).send({ items: [{ product_id: product.id, quantity: 1 }] });
    this.context.openTabId = tabId;
});
