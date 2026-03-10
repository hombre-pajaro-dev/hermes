# Hermes Mercury POS – Features and Scenarios (BDD)

This document lists all **features** and **scenarios** covered by the BDD test suite. It serves as viewable documentation for product behavior and acceptance criteria.

---

## 1. Checkout

**Feature:** As an employee, I want to create a checkout order and accept payment (cash or card) so that the customer can pay for selected items.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Complete a sale with credit card | Order with items; pay with card; order completes; stock decreases. |
| 2 | Complete a sale with cash and receive change | Order with items; pay with cash and amount received; system returns change due. |
| 3 | Cash payment with insufficient amount is rejected | Order total > amount received; payment is rejected. |
| 4 | Cannot checkout when register is closed | No open register; creating order and paying fails. |
| 5 | Cannot sell more units than in stock | Order quantity exceeds available stock; order is rejected. |

---

## 2. Tabs (Long-lasting orders)

**Feature:** As an employee, I want to open tabs for customers and add items so that the customer can pay at the end of the session.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Open a new tab and add items | Create tab; add products with quantities; tab total and line count are correct. |
| 2 | View open tabs summary | Create tab and add items; summary shows open count and total amount. |
| 3 | Pay a tab with cash | Add items to tab; pay tab with cash and amount received; tab closes; ledger records payment. |
| 4 | Pay a tab with card | Add items to tab; pay tab with card; tab closes. |
| 5 | Cannot close register while tabs are open | With at least one open tab; closing register is rejected; error mentions tabs/long-lasting orders. |

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

| # | Scenario | Description |
|---|----------|-------------|
| 1 | List products | Fetch products; response is array; each product has id, name, description, cost, price, units. |
| 2 | Get a single product | Fetch product by name; product has expected name, cost, price, units. |
| 3 | Create a new product | Create product with name, description, cost, price, units; product is created with correct attributes. |

---

## Running the BDD tests

- **Run all scenarios:**  
  `npm test`  
  (uses `NODE_ENV=test` and a separate test database.)

- **Generate HTML report:**  
  The Cucumber config writes an HTML report to `report/cucumber-report.html` after a run. Open that file in a browser for a viewable report.

- **Regenerate scenario list from feature files:**  
  `npm run test:doc`  
  (writes `docs/BDD_SCENARIOS.md` from the Gherkin feature files.)

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
