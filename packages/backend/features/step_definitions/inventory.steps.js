"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
async function getProductByName(agent, name) {
    const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    return res.body;
}
(0, cucumber_1.When)('I submit an inventory adjustment', async function (table) {
    const rows = table.hashes();
    const adjustments = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        this.context[`prev_${r.product_name}`] = p.units;
        return { product_id: p.id, physical_count: Number(r.physical_count) };
    }));
    this.response = await this.agent.post('/api/inventory/adjust').send({ adjustments });
});
(0, cucumber_1.When)('I try to submit an inventory adjustment', async function (table) {
    const rows = table.hashes();
    const adjustments = await Promise.all(rows.map(async (r) => {
        const p = await getProductByName(this.agent, r.product_name);
        return { product_id: p.id, physical_count: Number(r.physical_count) };
    }));
    this.response = await this.agent.post('/api/inventory/adjust').send({ adjustments });
});
(0, cucumber_1.Then)('the product {string} units are now {int}', async function (name, units) {
    const product = await getProductByName(this.agent, name);
    (0, chai_1.expect)(product.units).to.equal(units);
});
(0, cucumber_1.Then)('the ledger has an {string} entry with negative delta', async function (type) {
    const res = await this.agent.get('/api/ledger');
    const entries = res.body;
    const found = entries.find(e => e.entry_type === type && e.amount < 0);
    (0, chai_1.expect)(found, `Expected a '${type}' entry with negative delta`).to.exist;
});
(0, cucumber_1.Then)('the adjustment delta is positive', function () {
    const body = this.response.body;
    (0, chai_1.expect)(body.adjustments[0].delta).to.be.greaterThan(0);
});
