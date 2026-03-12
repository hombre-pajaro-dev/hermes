"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const chai_1 = require("chai");
(0, cucumber_1.When)('I open the register with opening cash {float}', async function (amount) {
    this.response = await this.agent.post('/api/register/open').send({ opening_cash: amount });
    if (this.response.status === 201)
        this.context.sessionId = this.response.body.id;
});
(0, cucumber_1.When)('I try to open the register with opening cash {float}', async function (amount) {
    this.response = await this.agent.post('/api/register/open').send({ opening_cash: amount });
});
(0, cucumber_1.When)('I cash out {float} with reason {string}', async function (amount, reason) {
    this.response = await this.agent.post('/api/register/cashout').send({ amount, reason });
});
(0, cucumber_1.When)('I close the register with closing cash {float}', async function (amount) {
    this.response = await this.agent.post('/api/register/close').send({ closing_cash: amount });
});
(0, cucumber_1.When)('I try to close the register without closing cash', async function () {
    this.response = await this.agent.post('/api/register/close').send({});
});
(0, cucumber_1.When)('I try to close the register with closing cash {float}', async function (amount) {
    this.response = await this.agent.post('/api/register/close').send({ closing_cash: amount });
});
(0, cucumber_1.Then)('the register status is {string}', async function (status) {
    if (status === 'open') {
        const res = await this.agent.get('/api/register/session');
        (0, chai_1.expect)(res.body).to.have.property('status', 'open');
    }
    else {
        const body = this.response.body;
        (0, chai_1.expect)(body.status).to.equal(status);
    }
});
(0, cucumber_1.Then)('the register opening cash is {float}', async function (amount) {
    const res = await this.agent.get('/api/register/session');
    (0, chai_1.expect)(res.body.opening_cash).to.be.closeTo(amount, 0.001);
});
(0, cucumber_1.Then)('the cashout is recorded with amount {float}', function (amount) {
    (0, chai_1.expect)(this.response.status).to.equal(201);
    const body = this.response.body;
    (0, chai_1.expect)(body.amount).to.be.closeTo(amount, 0.001);
});
(0, cucumber_1.Then)('the close brief has a revenue field', async function () {
    const res = await this.agent.get('/api/reports/close-brief');
    (0, chai_1.expect)(res.body).to.have.property('revenue');
});
(0, cucumber_1.Then)('the close brief has a total_cost field', async function () {
    const res = await this.agent.get('/api/reports/close-brief');
    (0, chai_1.expect)(res.body).to.have.property('total_cost');
});
