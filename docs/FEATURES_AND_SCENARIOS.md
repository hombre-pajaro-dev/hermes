# Hermes Mercury POS – Features and Scenarios (BDD)

This document lists all **features** and **scenarios** covered by the BDD test suite. It serves as viewable documentation for product behavior and acceptance criteria.

---

## 1. Checkout

**Feature:** As an employee, I want to create a checkout order and accept payment (cash or card) so that the customer can pay for selected items.

**UI — Add Items panel:** Shared `ProductPicker` component with search input, grid / list toggle (persisted under `checkout-view`), **● Active** filter (on by default, shared `product-active-filter`), **◈ In Stock** filter (on by default, shared `product-stock-filter`), and **↑ Most Sold** sort toggle (on by default, shared `product-sort`). Filter pipeline: active → in-stock → most-sold → render.

**Cart-aware availability:** The picker computes effective stock in real time from the current cart without any network calls. For supply-based products, all products that share a supply reflect each other's cart consumption immediately. For unit-based products, the picker shows `server units − cart quantity`. The **+** button in the order summary is also disabled when effective units reach zero.

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

**UI — Add Items panel:** Shared `ProductPicker` component with search input, grid / list toggle (persisted under `tabs-add-view`, defaults to list), **● Active** filter (on by default, shared `product-active-filter`), **◈ In Stock** filter (on by default, shared `product-stock-filter`), and **↑ Most Sold** sort toggle (on by default, shared `product-sort`). At-cost tabs display cost price with a `(cost)` label instead of the sale price.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Open a new tab and add items | Create tab; add products; same product added twice is grouped into one line with combined quantity; tab total is correct. |
| 2 | View open tabs summary | Create tab and add items; summary shows open count and total amount. |
| 3 | Pay a tab with cash | Add items to tab; pay tab with cash and amount received; tab closes; ledger records payment; `paid_at` timestamp recorded. |
| 4 | Pay a tab with card | Add items to tab; pay tab with card; tab closes. |
| 5 | Can close register with open tabs | With at least one open tab; closing register succeeds — tabs span multiple sessions and do not block. |
| 6 | Open multiple tabs simultaneously | Multiple tabs can be open at the same time; each is managed independently. |
| 7 | Create an at-cost (staff) tab | Create tab with `at_cost: true`; items added are priced at `product.cost` instead of `product.price`; `at_cost` flag cannot be changed after creation. |
| 8 | Closed tabs are paginated | Closed tabs list returns 10 per page; `paid_at` timestamp and payment method shown per entry. |
| 9 | Update item quantity on a tab | Change quantity of an existing tab item via `PATCH /api/tabs/:id/items/:itemId`; tab total recalculates correctly. |
| 10 | Remove an item by setting quantity to zero | Set item quantity to 0; item is deleted; tab total reflects the removal. |
| 11 | Stock count visible in Add Items | Each product in the Add Items section shows available units; out-of-stock products show "out of stock" and the + button is disabled. |
| 12 | Adding a product to a tab decrements its stock | Add items to tab; product units decrease by the quantity added. |
| 12 | Removing units from a tab item restores the stock | Add items then reduce quantity; net stock change matches net quantity on the tab. |
| 13 | Cannot add more items to a tab than available stock | Request quantity exceeding available units; rejected with 409. |
| 14 | Tab list includes items for each tab | `GET /api/tabs` returns each tab with an `items` array; items include product name and quantity. |
| 15 | Tab list shows item summary without opening the tab | In the Tabs list view, each open tab row displays a one-line summary of its items (e.g. `Espresso ×2 · Latte ×1`) without navigating into the tab. |

---

## 3. Register (Open / Close / Cashout)

**Feature:** As an employee, I want to open and close the POS register and cash out so that we track cash in the drawer and can remove excess.

> **UI location:** Register controls are now part of the **Admin** page (`/admin`). There is no separate Register route.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Open the register with starting cash | Register is closed; open with opening cash; session exists with that opening cash; ledger has register_open entry. |
| 2 | Cannot open register when already open | Register already open; opening again is rejected. |
| 3 | Cash out from the register | Register open; cash out amount with reason; cashout recorded; ledger has cashout entry. |
| 4 | Close the register and get day brief | Register open; close with closing cash; register closes; ledger has register_close; close brief includes revenue and cost. |
| 5 | Cannot close without closing_cash | Attempt to close without providing closing cash; close is rejected. |
| 6 | List all register sessions | `GET /api/register/sessions` returns an array with at least one entry after opening the register. |
| 7 | Session report contains orders-only sales | After paid orders in a session; `GET /api/register/sessions/:id/report` has `order_count ≥ 1`, positive `revenue`, and a `by_item` array. |
| 8 | Session report excludes tab sales | Paid tab in session; session report `order_count` is 0 (tab revenue not counted). |
| 9 | Opening register captures inventory snapshot | After opening; session report `session.inventory_snapshot_open` is non-null with a `products` array. |
| 10 | Closing register captures inventory snapshot | After closing; session report `session.inventory_snapshot_close` is non-null with a `products` array. |

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
| 8 | Ledger entry includes discount info when a discount was applied | After paying an order with a discount; fetch ledger; the sale entry includes `discount_name` matching the discount and a `discount_amount` greater than zero. |

---

## 5. Reports

**Feature:** As an admin employee, I want to see reports on sales and daily totals so that I can understand what was sold and revenue.

**UI — tabs:** By Item · Range · Brief · Historic · By Weekday · Sessions. The separate Daily tab has been removed; the daily summary (Orders, Sales, Cash, Card, Cost, Profit) now appears at the top of the By Item tab for the selected date range.

**By Item tab:** From/To date pickers filter both the item breakdown and the summary stats. Changing either date re-fetches automatically. Both `GET /api/reports/sales-by-item` and `GET /api/reports/daily-total` are called in parallel with the same `from`/`to`/`tz` parameters.

**Timezone support:** All date-filtered report endpoints accept an optional `tz` query parameter (IANA timezone name). The backend uses `AT TIME ZONE` to convert `paid_at` timestamps before date extraction. Default: `America/Monterrey`. The frontend passes the browser `Intl` timezone and computes "today" in local time.

**Historic tab:** SVG column chart groupable by Week (last 12 weeks), Month (full year), or Day (Jan 1 → today). Three bars per period: Revenue (blue), Cost (orange), Profit (green). Best period marked with ★. Daily view adds a dashed median line and a Median stats card. `GET /api/reports/historic?groupBy=week|month|day&tz=&year=`.

**By Weekday tab:** Median revenue / cost / profit per day of week (Mon–Sun) computed with `PERCENTILE_CONT(0.5)` over all days with sales in the current year. Chart + best-day card + ranked table. `GET /api/reports/by-weekday?tz=&year=`.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Sales by item report shows units and revenue | After a sale; report for today shows item, units sold, and revenue. |
| 2 | Daily total accepts from/to date range and includes tab payments | After an order and a tab payment; daily total with today's range counts both; order_count ≥ 2 and total_sales > 0. |
| 3 | Close brief includes revenue, cost, most sold and most profitable | Close brief has revenue, total_cost, most_sold, most_profitable, by_item. |
| 4 | Daily range report for chart | Request daily range from today to today; response has at least one day with date, revenue, cost, order_count. |
| 5 | Filter reports by date | Sales by item for a specific date; returns array without error. |
| 6 | Top products by all-time units sold | `GET /api/reports/top-products` returns all products with `units_sold` aggregated from all paid orders and tabs, sorted descending; products with no sales appear with `units_sold: 0`. |
| 7 | Sales by item report respects explicit timezone parameter | Pass `tz=America/Monterrey` with today's local date; report returns array without error. |
| 8 | By Item report shows daily summary alongside items | On the Reports page (By Item tab); daily-total stats grid visible; sales-by-item list visible. |
| 9 | Daily summary shows cash and card breakdown | On the Reports page; cash-sales and card-sales stats visible without switching tabs. |
| 10 | Daily total includes inventory_adjustment_total field | `daily-total` response always includes `inventory_adjustment_total` (number); reflects net cost impact of adjustments for the period. |
| 11 | Daily range includes adjustment per day | Each entry in `daily-range` includes an `adjustment` field; non-zero days show `adj ±$X.XX` in the Range view. |
| 12 | Inventory adjustment report shows per-product breakdown | After a shortage adjustment; `GET /api/reports/inventory-adjustments` returns the product with its `adjustment_count`, `total_delta`, and non-zero `total_cost_impact`. |
| 13 | Sessions tab shows session selector | On the Reports page; clicking the Sessions tab reveals a session dropdown (`session-selector`). |
| 14 | Sessions tab shows tab exclusion notice | Sessions tab displays a notice that tab sales are excluded because tabs span multiple sessions. |

**Sessions tab:** Dropdown to select any register session. Shows session metadata (opened/closed timestamps, opening/closing cash), a tab-exclusion notice, sales stats (orders/revenue/cash/card/cost/profit from counter orders only), inventory activity table (opening → closing → sold → restocked → adjusted per product, only shown when snapshots exist), a sales-by-product breakdown, and a cash removals list. `GET /api/register/sessions` and `GET /api/register/sessions/:id/report`.

**Inventory Adjustments card (By Item tab):** When any adjustments exist in the selected period, a card appears above the sales list showing each affected product with adjustment count, net unit delta, and cost impact (green = surplus, red = loss), plus a total impact row.

---

## 6. Restock inventory

**Feature:** As an employee, I want to insert a restock order to increase product units and restock supplies so that inventory reflects new stock.

> **Unit-based products** (no supply ingredients) are restocked directly via the Products section. **Supply-based products** cannot be directly restocked — their available units are computed from supplies. Use the Supplies section to restock the underlying supplies instead. **Inactive products** are hidden from the restock form.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Restock selected items with quantities | Restock order with product and quantities; product units increase; ledger has restock entry. |
| 2 | Restock only some products | Restock one product; that product’s units increase; others unchanged. |
| 3 | Cannot restock when register is closed | Register closed; restock order is rejected. |

---

## 7. Inventory adjustment

**Feature:** As an admin employee, I want to set physical count per product to match actual inventory so that discrepancies are recorded and losses appear on the ledger.

> Inventory adjustments apply to **active, unit-based products only**. Supply-based products have computed stock derived from their supplies; adjust the supplies directly instead. **Inactive products** are hidden from the adjustment form — they do not appear in the physical count list.

**Accounting:** Each adjustment posts a ledger entry to the `inventory_adjustment` account. Amount = `delta × product.cost`. Surplus (positive delta) = positive amount; shortage (negative delta) = negative amount. The account balance and daily totals reflect the cumulative cost impact of all adjustments.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Adjust inventory to match physical count (loss) | Set physical count below current; adjustment applied; product units updated; ledger has adjustment with loss. |
| 2 | Adjust inventory (increase – no loss) | Set physical count above current; adjustment applied; product units updated. |
| 3 | Cannot adjust when register is closed | Register closed; adjustment is rejected. |
| 4 | Adjustment is posted to the inventory_adjustment account | After a shortage adjustment; ledger has an `adjustment` entry with `account = inventory_adjustment`. |
| 5 | Shortage adjustment posts negative amount at cost price | Physical count below system count; adjustment entry amount is negative. |
| 6 | Surplus adjustment posts positive amount at cost price | Physical count above system count; adjustment entry amount is positive. |

---

## 8. Products

**Feature:** Products have name, description, cost, price, and available units (inventory). Products are either **unit-based** (stock tracked directly) or **supply-based** (stock computed from linked supply ingredients).

**UI:** The product catalogue is displayed via the shared `ProductPicker` component. All three views — Checkout, Tabs Add Items, and Products — share a consistent **search input** (filters by name, case-insensitive) and **grid / list toggle** (⊞ / ☰). View preference is persisted per-view in `localStorage`.

**Active / Inactive status:** Each product can be deactivated from the Products view. Inactive products appear at 55% opacity with an INACTIVE badge. The Add Items panel in Checkout and Tabs has a **● Active** filter toggle (on by default, shared `product-active-filter` key) that hides inactive products from the selling UI.

**Supply-based products:** Products linked to supplies show a `SUPPLY` badge and display their ingredient list (e.g. `20g Coffee grounds`). Their `units` value is computed server-side; they cannot be directly restocked or inventory-adjusted — manage their stock via their supplies.

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
| 13 | In-stock filter hides out-of-stock products in Add Items | Products with `units ≤ 0` are hidden in Checkout and Tabs when the ◈ In Stock filter is on (default). |

---

## 9. Supplies

**Feature:** As an admin, I want to manage raw supplies (e.g. coffee grounds, milk) and link them to products so that product stock is automatically computed from what is physically available.

**How it works:** Each supply has a name, a unit label (e.g. `g`, `ml`, `units`), and a current quantity. A product can be linked to one or more supplies with a `quantity_per_unit` (how much of the supply is consumed per sale). The product’s available units become `floor(min(supply.quantity / qty_per_unit))` across all its ingredients. When the product is sold, the corresponding supply quantities are deducted automatically.

**Admin — Supplies card:** Create, edit, and delete supplies. A supply cannot be deleted while any product uses it.

**Products view — supply ingredients:** Each product card/row has an "Edit Supplies" / "Link Supplies" button for inline ingredient editing. The create-product form has a "Uses supplies" checkbox that switches the units field to an ingredient picker.

**Restock view:** The Supplies section lists all supplies with quantity inputs; restocking a supply increases its quantity directly.

| # | Scenario | Description |
|---|----------|-------------|
| — | *(no BDD scenarios yet — covered by manual testing and the existing stock/checkout/tabs scenarios)* | |

---

## 10. Discounts

**Feature:** As an admin, I want to configure automatic and manual discounts so that qualifying orders receive a price reduction.

**Discount types:**
- **Percentage** — X% off a set of qualifying products (or the whole order if no products are specified)
- **Buy X Get Y Free** (BXGY) — every N qualifying items means the cheapest M are free; qualifying products must be specified

**Auto vs. manual:**
- **Auto-discounts** activate automatically when all configured conditions match (active flag, day of week, date range, redemption cap); the discount with the highest computed savings is applied; cashier can remove it
- **Manual / courtesy discounts** (`is_manual: true`) are never auto-applied; the cashier triggers them via "🎁 Apply courtesy…"; optionally protected by PIN

**Rules:**
- Only one discount per order/tab at a time; manual override replaces the auto-selected discount
- At-cost tabs are mutually exclusive with discounts
- Server re-validates eligibility at payment time; discount amount is recorded on `orders.discount_amount` / `tabs.discount_amount` and in `applied_discounts` with a name snapshot; `redemptions` counter is incremented atomically

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Create a discount | `POST /api/discounts` with valid body; discount created with correct fields. |
| 2 | Delete a discount | `DELETE /api/discounts/:id`; discount removed. |
| 3 | Percentage discount applied on checkout | Create 20% discount on Espresso; pay order with that discount; `discount_amount` equals 20% of Espresso price. |
| 4 | BXGY discount applied on checkout | Create buy-2-get-1-free discount; order with 3 eligible items; cheapest item is free. |
| 5 | Discount applied on tab payment | Add items to tab; pay tab with discount; `discount_amount` recorded on tab. |
| 6 | At-cost tab rejects discount | Tab with `at_cost: true`; pay with discount_id; rejected with 409. |
| 7 | Redemption counter incremented | Pay order with discount; `redemptions` on the discount increments by 1. |

---

## 11. Admin

**Feature:** As an admin, I want to manage the security PIN, control register open/close, manage authorized users, configure discounts, and manage supplies so that operations are secure and stock is configured correctly.

**Register sub-section:** The Register controls (open, cash out, close) live on the Admin page. All staff can open the register; cash out and close require PIN confirmation.

**Authorized Users sub-section (admin only):** Only users with `role: admin` see this section. Admins can add an email + role, change an existing user’s role, or remove a user. Changes take effect on the user’s next sign-in.

**Discounts sub-section (admin only):** Configure auto and manual discounts. See section 10 for detail.

**Supplies sub-section (admin only):** Create, edit, and delete supplies. See section 9 for detail.

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

- **Run backend tests only:**
  `cd packages/backend && pnpm test` — 66 scenarios

- **Run frontend tests only:**
  `cd packages/frontend && pnpm test` — 59 scenarios
  Requires Docker/Postgres running. The test script starts its own backend (`:3002`) and frontend (`:5174`) servers automatically.

- **HTML report:**
  Both packages write a Cucumber HTML report to `report/cucumber-report.html` after each run.

---

## Feature file locations

| Feature | Package | File |
|---------|---------|------|
| Checkout | backend + frontend | `features/checkout.feature` |
| Tabs (long-lasting orders) | backend | `features/tabs_long_lasting_orders.feature` |
| Tabs | frontend | `features/tabs.feature` |
| Register | backend + frontend | `features/register.feature` |
| Ledger & accounts | backend + frontend | `features/ledger.feature` |
| Reports | backend + frontend | `features/reports.feature` |
| Restock | backend + frontend | `features/restock.feature` |
| Inventory adjustment | backend | `features/inventory_adjustment.feature` |
| Inventory | frontend | `features/inventory.feature` |
| Products | backend + frontend | `features/products.feature` |
| Discounts | backend + frontend | `features/discounts.feature` |
| Admin (PIN, Register, Users, Discounts, Supplies) | frontend | `features/admin.feature` |
