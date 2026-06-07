import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { PosWorld } from '../support/world';

// ── Provider payment steps ───────────────────────────────────────────────────

When('I POST a provider payment of {float} from {string}', async function (this: PosWorld, amount: number, account: string) {
  const id = (this.context as { providerId?: number }).providerId;
  this.response = await this.agent.post(`/api/providers/${id}/payment`).send({ amount, account });
});

When('I POST a provider payment of {float} from {string} with description {string}',
  async function (this: PosWorld, amount: number, account: string, description: string) {
    const id = (this.context as { providerId?: number }).providerId;
    this.response = await this.agent.post(`/api/providers/${id}/payment`).send({ amount, account, description });
  }
);

When('I PATCH the product {string} provider to {string}', async function (this: PosWorld, productName: string, providerName: string) {
  const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
  const product = productRes.body as { id: number };
  const providersRes = await this.agent.get('/api/providers');
  const providers = providersRes.body as { id: number; name: string }[];
  const provider = providers.find(p => p.name === providerName);
  expect(provider, `Provider "${providerName}" not found`).to.exist;
  this.response = await this.agent.patch(`/api/products/${product.id}/provider`).send({ provider_id: provider!.id });
});

Then('the product {string} has provider_id set', async function (this: PosWorld, productName: string) {
  const res = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
  const product = res.body as { provider_id: number | null };
  expect(product.provider_id, 'Expected provider_id to be set').to.be.a('number');
});

Given('the product {string} is untracked and linked to provider {string}',
  async function (this: PosWorld, productName: string, providerName: string) {
    const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
    const product = productRes.body as { id: number };
    await this.agent.patch(`/api/products/${product.id}/track-inventory`).send({ track_inventory: false });
    const providersRes = await this.agent.get('/api/providers');
    const providers = providersRes.body as { id: number; name: string }[];
    const provider = providers.find(p => p.name === providerName);
    expect(provider, `Provider "${providerName}" not found`).to.exist;
    await this.agent.patch(`/api/products/${product.id}/provider`).send({ provider_id: provider!.id });
    (this.context as { untrackedProductId?: number }).untrackedProductId = product.id;
  }
);

Given('I sell {int} units of {string}', async function (this: PosWorld, qty: number, productName: string) {
  const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
  const product = productRes.body as { id: number };
  const orderRes = await this.agent.post('/api/checkout/orders').send({ items: [{ product_id: product.id, quantity: qty }] });
  const order = orderRes.body as { id: number };
  await this.agent.post(`/api/checkout/orders/${order.id}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
});

When('I fetch the session bill for today', async function (this: PosWorld) {
  const today = new Date().toISOString().split('T')[0];
  this.response = await this.agent.get(`/api/providers/session-bill?from=${today}&to=${today}&tz=UTC`);
});

Then('the session bill includes provider {string}', function (this: PosWorld, providerName: string) {
  const bills = this.response.body as { provider_name: string }[];
  expect(bills.some(b => b.provider_name === providerName), `Expected session bill to include "${providerName}"`).to.be.true;
});

Then('the session bill entry for {string} has qty_sold at least {int}', function (this: PosWorld, providerName: string, minQty: number) {
  const bills = this.response.body as { provider_name: string; products: { qty_sold: number }[] }[];
  const bill = bills.find(b => b.provider_name === providerName);
  expect(bill, `Bill for "${providerName}" not found`).to.exist;
  const totalQty = bill!.products.reduce((s, p) => s + p.qty_sold, 0);
  expect(totalQty).to.be.at.least(minQty);
});

Then('the session bill is empty', function (this: PosWorld) {
  const bills = this.response.body as unknown[];
  expect(bills).to.be.an('array').that.is.empty;
});

When(/^I GET \/api\/payees$/, async function (this: PosWorld) {
  this.response = await this.agent.get('/api/payees');
});

Then('the response includes a payee named {string}', function (this: PosWorld, name: string) {
  const body = this.response.body as { name: string }[];
  expect(body.some(p => p.name === name), `Expected payee "${name}" in list`).to.be.true;
});

When(/^I POST \/api\/payees with name "([^"]+)" type "([^"]+)"$/, async function (this: PosWorld, name: string, type: string) {
  this.response = await this.agent.post('/api/payees').send({ name, type });
  if (this.response.status === 201) {
    (this.context as { payeeId?: number }).payeeId = (this.response.body as { id: number }).id;
  }
});

Given('there is a payee {string} of type {string}', async function (this: PosWorld, name: string, type: string) {
  const res = await this.agent.post('/api/payees').send({ name, type, source_account: 'cash' });
  (this.context as { payeeId?: number }).payeeId = (res.body as { id: number }).id;
});

When('I PATCH the payee with active false', async function (this: PosWorld) {
  const id = (this.context as { payeeId?: number }).payeeId;
  this.response = await this.agent.patch(`/api/payees/${id}`).send({ active: false });
});

Then('the payee {string} is inactive', async function (this: PosWorld, name: string) {
  const res = await this.agent.get('/api/payees');
  const payees = res.body as { name: string; active: boolean }[];
  const payee = payees.find(p => p.name === name);
  expect(payee, `Payee "${name}" not found`).to.exist;
  expect(payee!.active).to.be.false;
});

When(/^I POST \/api\/payments\/run with the payee amount ([\d.]+) from "([^"]+)"$/,
  async function (this: PosWorld, amountStr: string, account: string) {
    const id = (this.context as { payeeId?: number }).payeeId;
    this.response = await this.agent.post('/api/payments/run').send({
      entries: [{ payee_id: id, amount: Number(amountStr), source_account: account }],
    });
  }
);

When(/^I POST \/api\/payments\/run with the payee amount ([\d.]+) from "([^"]+)" for the current session$/,
  async function (this: PosWorld, amountStr: string, account: string) {
    const id = (this.context as { payeeId?: number }).payeeId;
    const sessRes = await this.agent.get('/api/register/sessions');
    const sessions = sessRes.body as { id: number; status: string }[];
    const openSession = sessions.find(s => s.status === 'open');
    this.response = await this.agent.post('/api/payments/run').send({
      entries: [{ payee_id: id, amount: Number(amountStr), source_account: account }],
      session_id: openSession?.id,
    });
  }
);

When(/^I POST \/api\/payments\/run with the payee amount ([\d.]+) from "([^"]+)" for the last closed session$/,
  async function (this: PosWorld, amountStr: string, account: string) {
    const id = (this.context as { payeeId?: number }).payeeId;
    const sessRes = await this.agent.get('/api/register/sessions');
    const sessions = sessRes.body as { id: number; status: string }[];
    const lastClosed = sessions.find(s => s.status === 'closed');
    this.response = await this.agent.post('/api/payments/run').send({
      entries: [{ payee_id: id, amount: Number(amountStr), source_account: account }],
      session_id: lastClosed?.id,
    });
  }
);

Then('the session pnl expenses is {float}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { pnl: { expenses: number } };
  expect(body.pnl.expenses).to.be.closeTo(expected, 0.01);
});

Then('the session pnl cogs is {float}', function (this: PosWorld, expected: number) {
  const body = this.response.body as { pnl: { cogs: number } };
  expect(body.pnl.cogs).to.be.closeTo(expected, 0.01);
});

Then('the session by_item for {string} has cost {float}', function (this: PosWorld, productName: string, expected: number) {
  const body = this.response.body as { by_item: { name: string; cost: number }[] };
  const item = body.by_item.find(i => i.name === productName);
  expect(item, `Expected by_item for "${productName}"`).to.exist;
  expect(item!.cost).to.be.closeTo(expected, 0.01);
});

Then('the session report payments include {string} with amount {float}', function (this: PosWorld, description: string, amount: number) {
  const body = this.response.body as { payments: { description: string; amount: number }[] };
  const found = body.payments.find(p => p.description === description && Math.abs(p.amount - amount) < 0.01);
  expect(found, `Expected payment "${description}" with amount ${amount} in session report`).to.exist;
});

When(/^I POST \/api\/payments\/run with the payee amount ([\d.]+) from "([^"]+)" without session$/,
  async function (this: PosWorld, amountStr: string, account: string) {
    const payeeId = (this.context as { payeeId?: number }).payeeId;
    const db = await this.getDb();
    const { rows: [payee] } = await db.query('SELECT * FROM payees WHERE id = $1', [payeeId]);
    const entryType = payee.type === 'staff' ? 'payroll' : payee.type === 'savings' ? 'savings_transfer' : 'expense';
    // Insert directly with session_id = NULL to simulate a pre-auto-link orphaned entry
    await db.query(
      'INSERT INTO ledger_entries (entry_type, account, amount, description, created_by, session_id) VALUES ($1, $2, $3, $4, $5, NULL)',
      [entryType, account, -Math.abs(Number(amountStr)), payee.name, 'test']
    );
  }
);

Then('the session report unlinked_payments includes {string}', function (this: PosWorld, description: string) {
  const body = this.response.body as { unlinked_payments: { description: string }[] };
  expect(body.unlinked_payments, 'unlinked_payments missing from session report').to.be.an('array');
  expect(body.unlinked_payments.some(p => p.description === description),
    `Expected unlinked_payments to include "${description}"`).to.be.true;
});

Then('the session report unlinked_payments is empty', function (this: PosWorld) {
  const body = this.response.body as { unlinked_payments: unknown[] };
  expect(body.unlinked_payments, 'unlinked_payments missing from session report').to.be.an('array');
  expect(body.unlinked_payments).to.have.lengthOf(0);
});

When('I claim the unlinked payment {string} to the last session',
  async function (this: PosWorld, description: string) {
    const sessRes = await this.agent.get('/api/register/sessions');
    const sessions = sessRes.body as { id: number; status: string }[];
    const last = sessions.find(s => s.status === 'closed') ?? sessions[0];
    const reportRes = await this.agent.get(`/api/register/sessions/${last.id}/report`);
    const report = reportRes.body as { unlinked_payments: { id: number; description: string }[] };
    const entry = report.unlinked_payments.find(p => p.description === description);
    expect(entry, `Unlinked payment "${description}" not found`).to.exist;
    this.response = await this.agent.post(`/api/register/sessions/${last.id}/claim-payments`)
      .send({ entry_ids: [entry!.id] });
  }
);

When('I PATCH the payee default_weight to {float}', async function (this: PosWorld, weight: number) {
  const id = (this.context as { payeeId?: number }).payeeId;
  this.response = await this.agent.patch(`/api/payees/${id}`).send({ default_weight: weight });
});

Then('the payee {string} has default_weight {float}', async function (this: PosWorld, name: string, weight: number) {
  const res = await this.agent.get('/api/payees');
  const payees = res.body as { name: string; default_weight: number }[];
  const payee = payees.find(p => p.name === name);
  expect(payee, `Payee "${name}" not found`).to.exist;
  expect(Number(payee!.default_weight)).to.be.closeTo(weight, 0.01);
});

When(/^I POST \/api\/payments\/run with the payee amount ([\d.]+) from "([^"]+)" and note "([^"]+)"$/,
  async function (this: PosWorld, amountStr: string, account: string, note: string) {
    const id = (this.context as { payeeId?: number }).payeeId;
    this.response = await this.agent.post('/api/payments/run').send({
      entries: [{ payee_id: id, amount: Number(amountStr), source_account: account }],
      note,
    });
  }
);

Then('a ledger entry exists for {string} with amount {float} and type {string}',
  async function (this: PosWorld, description: string, amount: number, type: string) {
    const res = await this.agent.get('/api/ledger');
    const entries = res.body as { description: string; amount: number; entry_type: string }[];
    const found = entries.find(e => e.description === description && Math.abs(e.amount - amount) < 0.01 && e.entry_type === type);
    expect(found, `Expected ledger entry for "${description}" amount ${amount} type ${type}`).to.exist;
  }
);

// ── Commission steps ─────────────────────────────────────────────────────────

Given('a product {string} costs {float} and sells for {float} with {int} units',
  async function (this: PosWorld, name: string, cost: number, price: number, units: number) {
    const existing = await this.agent.get(`/api/products?name=${encodeURIComponent(name)}`);
    let product = existing.body as { id: number };
    if (!product.id) {
      const res = await this.agent.post('/api/products').send({ name, description: '', cost, price, units });
      product = res.body as { id: number };
    } else {
      await this.agent.patch(`/api/products/${product.id}/cost`).send({ cost });
      await this.agent.patch(`/api/products/${product.id}/price`).send({ price });
    }
    (this.context as { commissionProductId?: number }).commissionProductId = product.id;
  }
);

When('I create and pay an order for {int}x {string} with card',
  async function (this: PosWorld, qty: number, productName: string) {
    const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
    const product = productRes.body as { id: number };
    const orderRes = await this.agent.post('/api/checkout/orders').send({ items: [{ product_id: product.id, quantity: qty }] });
    const order = orderRes.body as { id: number };
    this.context.orderId = order.id;
    this.response = await this.agent.post(`/api/checkout/orders/${order.id}/pay`).send({ payment_method: 'card' });
  }
);

When('I create and pay an order for {int}x {string} with cash',
  async function (this: PosWorld, qty: number, productName: string) {
    const productRes = await this.agent.get(`/api/products?name=${encodeURIComponent(productName)}`);
    const product = productRes.body as { id: number };
    const orderRes = await this.agent.post('/api/checkout/orders').send({ items: [{ product_id: product.id, quantity: qty }] });
    const order = orderRes.body as { id: number };
    this.context.orderId = order.id;
    this.response = await this.agent.post(`/api/checkout/orders/${order.id}/pay`).send({ payment_method: 'cash', amount_received: 9999 });
  }
);

Then('a commission ledger entry exists on account {string}',
  async function (this: PosWorld, account: string) {
    const orderId = this.context.orderId as number;
    const res = await this.agent.get('/api/ledger');
    const entries = res.body as { entry_type: string; account: string; ref_id: number }[];
    const found = entries.find(e => e.entry_type === 'commission' && e.account === account && e.ref_id === orderId);
    expect(found, `Expected commission entry on account "${account}" for order ${orderId}`).to.exist;
  }
);

Then('a commission_transfer ledger entry exists on account {string}',
  async function (this: PosWorld, account: string) {
    const orderId = this.context.orderId as number;
    const res = await this.agent.get('/api/ledger');
    const entries = res.body as { entry_type: string; account: string; ref_id: number }[];
    const found = entries.find(e => e.entry_type === 'commission_transfer' && e.account === account && e.ref_id === orderId);
    expect(found, `Expected commission_transfer entry on account "${account}" for order ${orderId}`).to.exist;
  }
);

Then('no commission ledger entry exists for the order',
  async function (this: PosWorld) {
    const orderId = this.context.orderId as number;
    const res = await this.agent.get('/api/ledger');
    const entries = res.body as { entry_type: string; ref_id: number }[];
    const found = entries.find(e => (e.entry_type === 'commission' || e.entry_type === 'commission_transfer') && e.ref_id === orderId);
    expect(found, 'Expected no commission entry for cash order').to.not.exist;
  }
);

When(/^I PATCH \/api\/admin\/commissions with rate ([\d.]+)$/,
  async function (this: PosWorld, rateStr: string) {
    this.response = await this.agent.patch('/api/admin/commissions').send({ rate: Number(rateStr) });
  }
);

Then('the commission rate is {float}',
  function (this: PosWorld, rate: number) {
    const body = this.response.body as { rate: number };
    expect(body.rate).to.be.closeTo(rate, 0.0001);
  }
);
