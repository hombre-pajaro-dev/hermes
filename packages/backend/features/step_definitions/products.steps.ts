import { When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

When('I fetch all products', async function (this: PosWorld) {
  this.response = await this.agent.get('/api/products');
});

When('I fetch the product named {string}', async function (this: PosWorld, name: string) {
  this.response = await this.agent.get(`/api/products?name=${encodeURIComponent(name)}`);
});

When('I create a product with name {string} description {string} cost {float} price {float} units {int}', async function (this: PosWorld, name: string, description: string, cost: number, price: number, units: number) {
  this.response = await this.agent.post('/api/products').send({ name, description, cost, price, units });
});

Then('the response is a non-empty array', function (this: PosWorld) {
  expect(this.response.body).to.be.an('array').with.length.greaterThan(0);
});

Then('the response is an array', function (this: PosWorld) {
  expect(this.response.body).to.be.an('array');
});

Then('each product has fields id, name, description, cost, price, units', function (this: PosWorld) {
  const products = this.response.body as Record<string, unknown>[];
  for (const p of products) {
    expect(p).to.have.property('id');
    expect(p).to.have.property('name');
    expect(p).to.have.property('description');
    expect(p).to.have.property('cost');
    expect(p).to.have.property('price');
    expect(p).to.have.property('units');
  }
});

Then('the product name is {string}', function (this: PosWorld, name: string) {
  const body = this.response.body as { name: string };
  expect(body.name).to.equal(name);
});

Then('the product cost is {float}', function (this: PosWorld, cost: number) {
  const body = this.response.body as { cost: number };
  expect(body.cost).to.be.closeTo(cost, 0.001);
});

Then('the product price is {float}', function (this: PosWorld, price: number) {
  const body = this.response.body as { price: number };
  expect(body.price).to.be.closeTo(price, 0.001);
});

Then('the product has a units field', function (this: PosWorld) {
  expect(this.response.body).to.have.property('units');
});

Then('the product units is {int}', function (this: PosWorld, units: number) {
  const body = this.response.body as { units: number };
  expect(body.units).to.equal(units);
});
