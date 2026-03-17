"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
async function getProductByName(agent, name) {
    const res = await agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    return res.body;
}
(0, cucumber_1.When)('I fetch the ledger', async function () {
    this.response = await this.agent.get('/api/ledger');
});
(0, cucumber_1.When)('I fetch the account balances', async function () {
    this.response = await this.agent.get('/api/ledger/balances');
});
(0, cucumber_1.When)('I fetch the accounts list', async function () {
    this.response = await this.agent.get('/api/ledger/accounts');
});
(0, cucumber_1.When)('I record payroll of {float} from {string} with description {string}', async function (amount, account, description) {
    this.response = await this.agent.post('/api/ledger/payroll').send({ amount, account, description });
});
(0, cucumber_1.Then)('there is a {string} ledger entry with account {string}', function (type, account) {
    const entries = this.response.body;
    const found = entries.some(e => e.entry_type === type && e.account === account);
    (0, chai_1.expect)(found, `Expected a '${type}' entry with account '${account}'`).to.be.true;
});
(0, cucumber_1.Then)('the sale entry has a non-zero amount', function () {
    const entries = this.response.body;
    const sale = entries.find(e => e.entry_type === 'sale');
    (0, chai_1.expect)(sale).to.exist;
    (0, chai_1.expect)(sale.amount).to.not.equal(0);
});
(0, cucumber_1.Then)('the {string} account balance is positive', function (account) {
    const balances = this.response.body;
    const found = balances.find(b => b.account === account);
    (0, chai_1.expect)(found, `Account '${account}' not found`).to.exist;
    (0, chai_1.expect)(found.balance).to.be.greaterThan(0);
});
(0, cucumber_1.Then)('the {string} account is present in balances', function (account) {
    const balances = this.response.body;
    const found = balances.some(b => b.account === account);
    (0, chai_1.expect)(found, `Account '${account}' not present in balances`).to.be.true;
});
(0, cucumber_1.Then)('there is a {string} ledger entry with amount {float}', function (type, amount) {
    const entries = this.response.body;
    const found = entries.find(e => e.entry_type === type);
    (0, chai_1.expect)(found, `Expected a '${type}' entry`).to.exist;
    (0, chai_1.expect)(found.amount).to.be.closeTo(amount, 0.001);
});
(0, cucumber_1.Then)('the ledger payroll entry account is {string}', function (account) {
    const entries = this.response.body;
    const payroll = entries.find(e => e.entry_type === 'payroll');
    (0, chai_1.expect)(payroll).to.exist;
    (0, chai_1.expect)(payroll.account).to.equal(account);
});
(0, cucumber_1.Then)('the ledger entries are ordered by created_at descending', function () {
    const entries = this.response.body;
    for (let i = 1; i < entries.length; i++) {
        (0, chai_1.expect)(entries[i - 1].created_at >= entries[i].created_at, `Entry ${i - 1} (${entries[i - 1].created_at}) should be >= entry ${i} (${entries[i].created_at})`).to.be.true;
    }
});
(0, cucumber_1.Then)('the accounts list includes {string}', function (name) {
    const accounts = this.response.body;
    const found = accounts.some(a => a.name === name);
    (0, chai_1.expect)(found, `Account '${name}' not found`).to.be.true;
});
(0, cucumber_1.Then)('the sale ledger entry has items', async function () {
    const entries = this.response.body;
    const sale = entries.find(e => e.entry_type === 'sale');
    (0, chai_1.expect)(sale, 'Expected a sale entry').to.exist;
    const res = await this.agent.get(`/api/ledger/entries/${sale.id}/items`);
    (0, chai_1.expect)(res.status).to.equal(200);
    (0, chai_1.expect)(res.body).to.be.an('array').with.length.greaterThan(0);
    this.context.saleItems = res.body;
});
(0, cucumber_1.Then)('the sale items include {string} with quantity {int}', function (name, qty) {
    const items = this.context.saleItems;
    const item = items.find(i => i.name === name);
    (0, chai_1.expect)(item, `Expected item '${name}'`).to.exist;
    (0, chai_1.expect)(item.quantity).to.equal(qty);
});
(0, cucumber_1.Then)('the tab_payment ledger entry has items', async function () {
    const entries = this.response.body;
    const entry = entries.find(e => e.entry_type === 'tab_payment');
    (0, chai_1.expect)(entry, 'Expected a tab_payment entry').to.exist;
    const res = await this.agent.get(`/api/ledger/entries/${entry.id}/items`);
    (0, chai_1.expect)(res.status).to.equal(200);
    (0, chai_1.expect)(res.body).to.be.an('array').with.length.greaterThan(0);
    this.context.tabPaymentItems = res.body;
});
(0, cucumber_1.Then)('the tab payment items include {string} with quantity {int}', function (name, qty) {
    const items = this.context.tabPaymentItems;
    const item = items.find(i => i.name === name);
    (0, chai_1.expect)(item, `Expected item '${name}'`).to.exist;
    (0, chai_1.expect)(item.quantity).to.equal(qty);
});
