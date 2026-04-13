# Hermes Mercury POS – Features and Scenarios (BDD)

This document lists all **features** and **scenarios** covered by the BDD test suite. It serves as viewable documentation for product behavior and acceptance criteria.

---

## 1. Checkout

**Feature:** As an employee, I want to create a checkout order and accept payment (cash or card) so that the customer can pay for selected items.

**UI — Add Items panel:** Shared `ProductPicker` component with search input, grid / list toggle (persisted under `checkout-view`), and **↑ Most Sold** sort toggle (on by default, persisted under `product-sort` — shared with Tabs).

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Complete a sale with credit card | Order with items; pay with card; order completes; stock decreases. |
| 2 | Complete a sale with cash and receive change | Order with items; pay with cash and amount received; system returns change due. |
| 3 | Cash payment with insufficient amount is rejected | Order total > amount received; payment is rejected. |
| 4 | Cannot checkout when register is closed | No open register; creating order and paying fails. |
| 5 | Cannot sell more units than in stock | Order quantity exceeds available stock; order is rejected. |

---

## 2. Tabs (Long-lasting orders)

**Feature:** As an employee, I want to open tabs for customers and add items so that the customer can pay at the end of the session. Multiple tabs can be open simultaneously. Tabs may optionally be created as at-cost (staff) tabs.

**UI — Add Items panel:** Shared `ProductPicker` component with search input, grid / list toggle (persisted under `tabs-add-view`, defaults to list), and **↑ Most Sold** sort toggle (on by default, persisted under `product-sort` — shared with Checkout). At-cost tabs display cost price with a `(cost)` label instead of the sale price.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Open a new tab and add items | Create tab; add products; same product added twice is grouped into one line with combined quantity; tab total is correct. |
| 2 | View open tabs summary | Create tab and add items; summary shows open count and total amount. |
| 3 | Pay a tab with cash | Add items to tab; pay tab with cash and amount received; tab closes; ledger records payment; `paid_at` timestamp recorded. |
| 4 | Pay a tab with card | Add items to tab; pay tab with card; tab closes. |
| 5 | Cannot close register while tabs are open | With at least one open tab; closing register is rejected. |
| 6 | Open multiple tabs simultaneously | Multiple tabs can be open at the same time; each is managed independently. |
| 7 | Create an at-cost (staff) tab | Create tab with `at_cost: true`; items added are priced at `product.cost` instead of `product.price`; `at_cost` flag cannot be changed after creation. |
| 8 | Closed tabs are paginated | Closed tabs list returns 10 per page; `paid_at` timestamp and payment method shown per entry. |
| 9 | Update item quantity on a tab | Change quantity of an existing tab item via `PATCH /api/tabs/:id/items/:itemId`; tab total recalculates correctly. |
| 10 | Remove an item by setting quantity to zero | Set item quantity to 0; item is deleted; tab total reflects the removal. |
| 11 | Stock count visible in Add Items | Each product in the Add Items section shows available units; out-of-stock products show "out of stock" and the + button is disabled. |
| 12 | Adding a product to a tab decrements its stock | Add items to tab; product units decrease by the quantity added. |
| 12 | Removing units from a tab item restores the stock | Add items then reduce quantity; net stock change matches net quantity on the tab. |
| 13 | Cannot add more items to a tab than available stock | Request quantity exceeding available units; rejected with 409. |

---

## 3. Register (Open / Close / Cashout)

**Feature:** As an employee, I want to open and close the POS register and cash out so that we track cash in the drawer and can remove excess.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Open the register with starting cash | Register is closed; open with opening cash; session exists with that opening cash; ledger has register_open entry. |
| 2 | Cannot open register when already open | Register already open; opening again is rejected. |
| 3 | Cash out from the register | Register open; cash out amount with reason; cashout recorded; ledger has cashout entry. |
| 4 | Close the register and get day brief | Register open, no open tabs; close with closing cash; register closes; ledger has register_close; close brief includes revenue and cost. |
| 5 | Cannot close without closing_cash | Attempt to close without providing closing cash; close is rejected. |

---

## 4. General Ledger and Accounts

**Feature:** As an employee or admin, I want the system to record all orders and events by timestamp and track money per account (cash, credit card), and record payroll, so that we have a full audit trail and account balances.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Ledger records a sale with timestamp and account | Create and pay order; fetch ledger; latest sale entry has amount and account. |
| 2 | View account balances | After a cash sale; fetch balances; cash account and credit_card account appear with correct balance logic. |
| 3 | Record a payroll payment from an account | Record payroll amount from an account with description; payroll recorded; ledger has payroll entry; account balance decreases. |
| 4 | Ledger entries are ordered by timestamp | Ledger list is ordered by created_at descending. |
| 5 | List accounts | Fetch accounts; list includes cash and credit_card. |
| 6 | View items for a sale ledger entry | After a card order; fetch ledger; `GET /ledger/:id/items` on the sale entry returns items with correct product name and quantity. |
| 7 | View items for a tab payment ledger entry | After a paid tab; fetch ledger; `GET /ledger/:id/items` on the tab_payment entry returns items with correct product name and quantity. |

---

## 5. Reports

**Feature:** As an admin employee, I want to see reports on sales and daily totals so that I can understand what was sold and revenue.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Sales by item report shows units and revenue | After a sale; report for today shows item, units sold, and revenue. |
| 2 | Daily total report shows order count and totals | Report for today has order_count, total_sales, total_cost. |
| 3 | Close brief includes revenue, cost, most sold and most profitable | Close brief has revenue, total_cost, most_sold, most_profitable, by_item. |
| 4 | Daily range report for chart | Request daily range from today to today; response has at least one day with date, revenue, cost, order_count. |
| 5 | Filter reports by date | Sales by item for a specific date; returns array without error. |
| 6 | Top products by all-time units sold | `GET /api/reports/top-products` returns all products with `units_sold` aggregated from all paid orders and tabs, sorted descending; products with no sales appear with `units_sold: 0`. |

---

## 6. Restock inventory

**Feature:** As an employee, I want to insert a restock order to increase product units so that inventory reflects new stock.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Restock selected items with quantities | Restock order with product and quantities; product units increase; ledger has restock entry. |
| 2 | Restock only some products | Restock one product; that product’s units increase; others unchanged. |
| 3 | Cannot restock when register is closed | Register closed; restock order is rejected. |

---

## 7. Inventory adjustment

**Feature:** As an admin employee, I want to set physical count per product to match actual inventory so that discrepancies are recorded and losses appear on the ledger.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Adjust inventory to match physical count (loss) | Set physical count below current; adjustment applied; product units updated; ledger has adjustment with loss. |
| 2 | Adjust inventory (increase – no loss) | Set physical count above current; adjustment applied; product units updated. |
| 3 | Cannot adjust when register is closed | Register closed; adjustment is rejected. |

---

## 8. Products

**Feature:** Products have name, description, cost, price, and units (inventory). All products are sold by units with a sale price and a cost.

**UI:** The product catalogue is displayed via the shared `ProductPicker` component. All three views — Checkout, Tabs Add Items, and Products — share a consistent **search input** (filters by name, case-insensitive) and **grid / list toggle** (⊞ / ☰). View preference is persisted per-view in `localStorage`.

**Active / Inactive status:** Each product can be deactivated from the Products view. Inactive products appear at 55% opacity with an INACTIVE badge. The Add Items panel in Checkout and Tabs has a **● Active** filter toggle (on by default, shared `product-active-filter` key) that hides inactive products from the selling UI.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | List products | Fetch products; response is array; each product has id, name, description, cost, price, units. |
| 2 | Get a single product | Fetch product by name; product has expected name, cost, price, units. |
| 3 | Create a new product | Create product with name, description, cost, price, units; product is created with correct attributes. |
| 4 | Modify the price of a product | Update price via `PATCH /api/products/:id/price`; new price returned; no ledger entry created. |
| 5 | Cannot set price to zero or below | Attempt to set price ≤ 0; request rejected with 400. |
| 6 | Cannot modify price when product is in an open tab | Product in open tab; price update rejected with 409. |
| 7 | Modify the cost of a product | Update cost via `PATCH /api/products/:id/cost`; new cost returned; no ledger entry created. |
| 8 | Cannot set cost to zero or below | Attempt to set cost ≤ 0; request rejected with 400. |
| 9 | Cannot modify cost when product is in an open tab | Product in open tab; cost update rejected with 409. |
| 10 | Deactivate a product | `PATCH /api/products/:id/active` with `{ active: false }`; product returns with `active: false`. |
| 11 | Reactivate a product | `PATCH /api/products/:id/active` with `{ active: true }`; product returns with `active: true`. |
| 12 | Active filter hides inactive products in Add Items | Products with `active: false` are hidden in Checkout and Tabs when the ● Active filter is on (default). |

---

## 9. Admin — PIN Security

**Feature:** As an admin, I want to manage the security PIN and protect sensitive operations so that unauthorised staff cannot perform cash-outs, close the register, or open staff-cost tabs.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Change the PIN successfully | On Admin page; enter correct current PIN and matching new PIN; success message shown; PIN updated. |
| 2 | Cannot change PIN with incorrect current PIN | Enter wrong current PIN; request rejected; error shown. |
| 3 | Cannot change PIN when new PINs do not match | Enter current PIN but mismatched new/confirm PINs; rejected with error before API call. |
| 4 | Wrong PIN on cash out is rejected | Fill in cashout fields; click Cash Out; enter wrong PIN in modal; PIN error shown in modal. |
| 5 | Wrong PIN on close register is rejected | Fill in closing cash; click Close Register; enter wrong PIN; PIN error shown in modal. |
| 6 | Wrong PIN on at-cost tab is rejected | Navigate to Tabs; fill new at-cost tab form; click Open Tab; enter wrong PIN; PIN error shown. |

---

## Running the BDD tests

- **Run all scenarios:**
  `pnpm test` (run from the relevant package directory)
  Uses `NODE_ENV=test` and an in-memory SQLite database.

- **Run backend tests only:**
  `cd packages/backend && pnpm test` — 42 scenarios, 207 steps

- **Run frontend tests only:**
  `cd packages/frontend && pnpm test` — 38 scenarios, 204 steps
  Requires both backend (`:3001`) and frontend (`:5173`) servers running.

- **HTML report:**
  Both packages write a Cucumber HTML report to `report/cucumber-report.html` after each run.

---

## Feature file locations

| Feature | File |
|---------|------|
| Checkout | `features/checkout.feature` |
| Tabs (long-lasting orders) | `features/tabs_long_lasting_orders.feature` |
| Register | `features/register.feature` |
| Ledger & accounts | `features/ledger.feature` |
| Reports | `features/reports.feature` |
| Restock | `features/restock.feature` |
| Inventory adjustment | `features/inventory_adjustment.feature` |
| Products | `features/products.feature` |
| Admin — PIN Security | `features/admin.feature` |
