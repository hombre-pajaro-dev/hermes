"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
async function getProductByName(agent, name) {
    const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    return res.body;
}
(0, cucumber_1.When)('I submit a restock order with items', async function (table) {
    const rows = table.hashes();
    // Store initial units
    for (const row of rows) {
        const p = await getProductByName(this.agent, row.product_name);
        this.context[`initial_${row.product_name}`] = p.units;
    }
    const items = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        return { product_id: p.id, quantity: Number(r.quantity) };
    }));
    this.response = await this.agent.post('/api/restock').send({ items });
});
(0, cucumber_1.When)('I try to submit a restock order with items', async function (table) {
    const rows = table.hashes();
    const items = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        return { product_id: p.id, quantity: Number(r.quantity) };
    }));
    this.response = await this.agent.post('/api/restock').send({ items });
});
(0, cucumber_1.Then)('the product {string} units increased by {int}', async function (name, increase) {
    const initialUnits = { Espresso: 100, Croissant: 50, Latte: 80 };
    const product = await getProductByName(this.agent, name);
    (0, chai_1.expect)(product.units).to.equal(initialUnits[name] + increase);
});
(0, cucumber_1.Then)('the product {string} units remain at {int}', async function (name, units) {
    const product = await getProductByName(this.agent, name);
    (0, chai_1.expect)(product.units).to.equal(units);
});
