# Hermes Mercury POS – Features and Scenarios (BDD)

This document lists all **features** and **scenarios** covered by the BDD test suite. It serves as viewable documentation for product behavior and acceptance criteria.

---

## 1. Checkout

**Feature:** As an employee, I want to create a checkout order and accept payment (cash or card) so that the customer can pay for selected items.

**Responsive layout:** On tablet (≥1024px) a fixed 60/40 split shows the product picker on the left and the cart panel on the right at all times. On phone (<1024px) the product picker is full-screen; a sticky bar at the bottom (visible when cart has items) opens a full-screen cart panel. The left product panel dims and disables pointer-events while cash input is expanded (tablet only).

**Inline cash payment:** Tapping "Pay with Cash" expands a cash-received input and live change display inline in the cart footer — no page navigation. Tapping "Cancel" collapses it back to the payment buttons.

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

**Last updated timestamp:** Every tab mutation (add items, update quantity, pay, void) stamps `updated_at = NOW()` on the row. Displayed as "Updated {date time}" in the list row (open and closed) and in the detail view header.

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
| 16 | Can open a tab when register is closed | Register is closed but a prior session exists; `POST /tabs` succeeds and the tab is linked to the most recent session. |
| 17 | Adding items to a tab sets updated_at | After adding items; `GET /api/tabs/:id` returns `updated_at` as a non-null timestamp. |
| 18 | Updating item quantity advances updated_at | Add items; record `updated_at`; update quantity; new `updated_at` is ≥ the recorded value. |
| 19 | Tab list shows last updated timestamp (E2E) | Tab with items visible in list; row shows "Updated {date time}". |
| 20 | Tab detail shows last updated timestamp (E2E) | Open tab detail; header card shows "Updated {date time}" next to status badge. |

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
| 11 | Opening register records only the variance against current cash balance | Fresh DB (balance = 0); open with 200; `register_open` ledger entry amount = 200 (the full variance). |
| 12 | Closing register records zero variance when counted cash matches expected | Open 200, no sales, close 200; `register_close` entry amount = 0. |
| 13 | Closing register records negative variance when cash is short | Open 200, close 175; `register_close` entry amount = −25. |
| 14 | Closing register records positive variance when cash is over | Open 200, close 210; `register_close` entry amount = +10. |
| 15 | Session report includes expected_cash and cash_variance | Open 200, close 175; session report `expected_cash` = 200 and `cash_variance` = −25. |
| 16 | Closing register includes cash from tabs opened in a previous session | Tab opened in session 1 (Espresso $3); session 1 closed; session 2 opened with $200; tab paid in cash; close session 2 with $203; `expected_cash` = 203, `cash_variance` = 0. |
| 17 | Closing register with physical counts creates inventory adjustments for discrepancies | Close with physical count of 90 for Espresso (system has 100); session report includes adjustment for Espresso. |
| 18 | Closing register with physical counts matching system does not create adjustments | Close with physical count matching system units; session report adjustments array is empty. |
| 19 | Run a payment with session_id appears in the session report | Run payment for closed session; `GET /register/sessions/:id/report` payments array includes that payee with correct amount. |

---

## 4. General Ledger and Accounts

**Feature:** As an employee or admin, I want the system to record all orders and events by timestamp and track money per account (cash, credit card), so that we have a full audit trail and account balances.

**Payments tab (admin only):** Ledger now hosts the Payments panel under a third tab. Admin sees current Cash and Card balances, a date-range Period Summary (Revenue / Cost / Gross Profit / Orders via `GET /api/reports/daily-total`), then the full payment distribution form and Manage Payees section.

**Account Adjustment (admin only, Balances tab):** Below the accounts list, admins see an "Account Adjustment" card to manually add or remove money from any account. Fields: account selector, Add/Remove toggle, amount, description (required). Posts to `POST /api/ledger/adjustment`; creates an `account_adjustment` ledger entry. Positive amount = credit; negative = debit. Balances and ledger entries refresh after submit.

**Ledger entry enrichment for tab payments:** `GET /api/ledger` now joins the `tabs` table for `tab_payment` entries and includes two extra fields: `tab_at_cost` (1 if the tab was a staff/cost tab, null otherwise) and `tab_opened_by` (email of who opened the tab, null in test/anonymous mode). Display: **COST badge** — purple inline badge on any at-cost tab payment, visible to all users. **Opened by** (admin only) — shown below the description on tab payment rows. **Contextual actor label** (admin only) — `tab_payment` shows "paid by", `payroll`/`expense`/`savings_transfer` show "recorded by", all others show "by".

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Ledger records a sale with timestamp and account | Create and pay order; fetch ledger; latest sale entry has amount and account. |
| 2 | View account balances | After a cash sale; fetch balances; cash account and credit_card account appear with correct balance logic. |
| 3 | Record a payroll payment from an account | (Backend only) Record payroll amount from an account with description; payroll recorded; ledger has payroll entry; account balance decreases. |
| 4 | Ledger entries are ordered by timestamp | Ledger list is ordered by created_at descending. |
| 5 | List accounts | Fetch accounts; list includes cash and credit_card. |
| 6 | View items for a sale ledger entry | After a card order; fetch ledger; `GET /ledger/:id/items` on the sale entry returns items with correct product name and quantity. |
| 7 | View items for a tab payment ledger entry | After a paid tab; fetch ledger; `GET /ledger/:id/items` on the tab_payment entry returns items with correct product name and quantity. |
| 8 | Ledger entry includes discount info when a discount was applied | After paying an order with a discount; fetch ledger; the sale entry includes `discount_name` matching the discount and a `discount_amount` greater than zero. |
| 9 | Admin can add money to an account via adjustment | `POST /api/ledger/adjustment` with positive amount; `account_adjustment` ledger entry created with correct account and amount. |
| 10 | Admin can remove money from an account via adjustment | `POST /api/ledger/adjustment` with negative amount; `account_adjustment` ledger entry created with negative amount. |
| 11 | Admin sees account adjustment form in Balances tab (E2E) | On Ledger Balances tab; account selector, type toggle, amount/description inputs, and submit button are visible. |
| 12 | Tab payment entry for at-cost tab includes tab_at_cost flag | Pay an at-cost tab; `GET /api/ledger` response has `tab_at_cost = 1` on the `tab_payment` entry. |
| 13 | Tab payment entry includes tab_opened_by field | Pay any tab; `GET /api/ledger` response includes `tab_opened_by` key on the `tab_payment` entry. |
| 14 | At-cost tab payment shows COST badge in ledger (E2E) | Paid at-cost tab in DB; Ledger Entries shows purple COST badge on the `tab payment` row. |
| 15 | Transfer between accounts creates debit and credit entries | `POST /api/ledger/transfer` from `cash` to `credit_card`; two `transfer` entries created — debit (negative) on source, credit (positive) on destination. |
| 16 | Transfer to the same account is rejected | `POST /api/ledger/transfer` with identical `from_account` and `to_account`; request rejected with 400. |

---

## 5. Reports

**Feature:** As an admin employee, I want to see reports on sales and daily totals so that I can understand what was sold and revenue.

**UI — tabs:** By Item · Range · Brief · Historic · By Weekday · Sessions. The separate Daily tab has been removed; the daily summary (Orders, Sales, Cash, Card, Cost, Profit) now appears at the top of the By Item tab for the selected date range.

**By Item tab:** From/To datetime pickers (datetime-local inputs) filter both the item breakdown and the summary stats. Fetching is triggered by an Apply button — no auto-fetch on change. Both `GET /api/reports/sales-by-item` and `GET /api/reports/daily-total` are called in parallel with the same `from`/`to`/`tz` parameters. Defaults to today at 00:00 – 23:59.

**Range tab:** From/To datetime pickers with an Apply button. Multi-day ranges apply the time bound only to the first and last day; days in between are shown in full (ADR-0002).

**Shared `DateTimeRangeFilter` component:** Used by both By Item and Range tabs. Manages internal draft state; calls `onApply(from, to)` only on Apply click. Accepts `initialFrom`, `initialTo`, `onApply`, and optional `loading` prop.

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
| 15 | Sales by item report respects time component of datetime range | Query with `T00:00`–`T00:01` returns empty; confirms time precision is applied (not date-only truncation). |
| 16 | Daily range respects time bounds on first and last day | Query a single day with `T00:00`–`T00:01`; first day entry has zero revenue (ADR-0002). |
| 17 | By Item tab has Apply button with datetime inputs | By Item tab renders `datetime-local` inputs and a `date-range-apply-btn`; no auto-fetch on change. |
| 18 | Range tab Apply button triggers fetch | Clicking Apply on the Range tab loads the range report. |

**Sessions tab:** Dropdown to select any register session. Shows session metadata (opened/closed timestamps, opening/closing cash), a tab-exclusion notice, sales stats (orders/revenue/cash/card/cost/profit from counter orders only), inventory activity table (opening → closing → sold → restocked → adjusted per product, only shown when snapshots exist), a sales-by-product breakdown, and a cash removals list. `GET /api/register/sessions` and `GET /api/register/sessions/:id/report`.

**Inventory Adjustments card (By Item tab):** When any adjustments exist in the selected period, a card appears above the sales list showing each affected product with adjustment count, net unit delta, and cost impact (green = surplus, red = loss), plus a total impact row.

---

## 6. Restock inventory

**Feature:** As an admin, I want to insert a restock order linked to a provider and record the payment so that purchase costs are tracked in the ledger.

> **Admin only.** Unit-based products restocked directly; supply-based products via the Supplies section. Inactive products hidden from the form.

**Provider combobox:** Type to filter existing providers; select from dropdown. If typed name has no exact match, a "Create ‘{name}’" option appears and creates the provider on selection. Providers are stored in the `providers` table.

**Purchase Details card:** Provider (required), Payment Amount (required, > 0), Pay from Account (Cash or Card). These are captured before the product quantities.

**Per-item unit cost:** Each product row has an editable unit cost input pre-filled with `product.cost`. If the user changes the cost, the stored `product.cost` is updated after the restock and `restock_items.previous_cost` records the old value.

**Auto-computed total:** Payment amount = Σ(quantity × unit_cost) across all items; shown in the form before submit and stored on `restock_orders.payment_amount`.

**Cost-changed tag in ledger:** When expanding a `restock` entry, any item whose `unit_price` differs from `previous_cost` shows an amber "was $X.XX" badge in the Unit column.

**Ledger:** The `restock` ledger entry is created with `amount = −payment_amount` and `account = payment_account`, and the description reads `Restock from {provider_name}`.

**API:** `GET /api/providers`, `POST /api/providers`. `POST /api/restock` now accepts `provider_id`, `payment_amount`, `payment_account` (all optional for backward compat; UI enforces them).

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Restock selected items with quantities | Restock order with product and quantities; product units increase; ledger has restock entry. |
| 2 | Restock only some products | Restock one product; that product’s units increase; others unchanged. |
| 3 | Cannot restock when register is closed | Register closed; restock order is rejected. |
| 4 | Restock with provider and payment creates ledger entry with amount | Submit restock with provider + payment; response includes provider info; ledger `restock` entry has negative payment amount. |
| 5 | List providers returns created providers | `GET /api/providers` returns previously created provider. |
| 6 | Restock form shows provider input, total paid inputs, and payment account (E2E) | On Restock page; provider input, per-product total paid input, and account selector all visible. |
| 7 | Products in restock form show unit cost (E2E) | On Restock page; each product row shows current `product.cost`; unit cost derived as total ÷ qty and displayed read-only. |
| 8 | Restock with provider and payment creates ledger entry with amount | Submit restock with provider + per-item unit cost; ledger `restock` entry amount = −sum(qty × unit_cost). |
| 9 | Custom unit cost updates product cost and stores previous_cost | Submit restock with unit_cost ≠ product.cost; `products.cost` updated; ledger items include `previous_cost`. |
| 10 | Restock ledger entry items show restocked products | After restock; `GET /api/ledger/entries/:id/items` returns products with name, quantity, unit_price, subtotal, previous_cost. |
| 11 | Restock ledger entry is expandable and shows products (E2E) | On Ledger Entries; restock row expandable; shows item rows. |
| 12 | Restock ledger entry shows cost-updated tag when unit cost changed (E2E) | Expand restock entry where cost changed; amber "was $X.XX" badge visible on that item row. |

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

**Admin-only editing:** All product mutations (create, edit price/cost, activate/deactivate, toggle inventory tracking, change image, edit supply links) are visible and accessible **only to admins**. Staff see the product catalogue in read-only mode — no buttons, no edit inputs, no image picker interaction.

**Tab-reserved indicator:** Each product displays an amber "X in open tabs" label when units are currently reserved across active tabs. Aggregated client-side from open tab details on page load. Visible to all roles.

**UI:** The product catalogue is displayed via the shared `ProductPicker` component. All three views — Checkout, Tabs Add Items, and Products — share a consistent **search input** (filters by name, case-insensitive) and **grid / list toggle** (⊞ / ☰). View preference is persisted per-view in `localStorage`.

**Active / Inactive status:** Each product can be deactivated from the Products view. Inactive products appear at 55% opacity with an INACTIVE badge. The Add Items panel in Checkout and Tabs has a **● Active** filter toggle (on by default, shared `product-active-filter` key) that hides inactive products from the selling UI.

**Supply-based products:** Products linked to supplies show a `SUPPLY` badge and display their ingredient list (e.g. `20g Coffee grounds`). Their `units` value is computed server-side; they cannot be directly restocked or inventory-adjusted — manage their stock via their supplies.

**Inventory tracking toggle:** Unit-based products can be marked as `track_inventory: false`. Untracked products are always sellable (the ◈ In Stock filter never hides them; the + button is never disabled); selling does not decrement their `units`; they are hidden from Restock and Inventory Adjustment views. Sold quantities are still recorded in `order_items` / `tab_items` for revenue reporting. Products view shows a `NO TRACK` badge and "∞ units"; toggled via `PATCH /api/products/:id/track-inventory`.

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
| 14 | Disable inventory tracking on a product | `PATCH /api/products/:id/track-inventory` with `{ track_inventory: false }`; product returns with `track_inventory: false`; available units reported as 999999. |
| 15 | Untracked product is always available and never deducted | Sell an untracked product; `products.units` unchanged; `getProductAvailableUnits` always returns 999999. |
| 16 | Restock and adjustment reject untracked products | Attempt to restock or inventory-adjust an untracked product; rejected with error "inventory tracking disabled". |
| 17 | Staff cannot see product edit controls (E2E) | As staff user on Products page; Add Product button, Edit price/cost buttons, Activate/Deactivate buttons, and image picker are all hidden. |
| 18 | Products show units reserved in open tabs | Product with items on an open tab displays amber "X in open tabs" count; product with no open tab items shows no indicator. |

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
- **Manual / courtesy discounts** (`is_manual: true`) are never auto-applied; the cashier triggers them via "🎁 Apply courtesy…"; optionally admin-only (`requires_pin: true` = visible to admins only)

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

**Feature:** As an admin, I want to control register operations, manage authorized users, configure discounts, and manage supplies so that operations are secure and stock is configured correctly.

**Submenu navigation:** Admin page uses a tab-based submenu — **Register**, **Discounts** (admin only), **Supplies** (admin only), **Users** (admin only). Staff see only the Register tab.

**Register sub-section:** Open, cash out, and close controls. All staff can open the register; cash out and close are admin-only (backend enforced via `requireAdmin` + frontend hides the cards for non-admins).

**Authorized Users sub-section (admin only):** Only users with `role: admin` see this section. Admins can add an email + role, change an existing user’s role, or remove a user. Changes take effect on the user’s next sign-in.

**Discounts sub-section (admin only):** Configure auto and manual discounts. See section 10 for detail.

**Supplies sub-section (admin only):** Create, edit, and delete supplies. See section 9 for detail.

**Role-based access control:** PIN system removed entirely. Sensitive operations are gated by RBAC — see the Role permissions table in CLAUDE.md.

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Admin submenu shows Register section by default | On Admin page; Register section (session status card) is visible without any navigation. |
| 2 | Admin can navigate to Discounts section | On Admin page; click Discounts tab; Discounts section becomes active. |

---

## 12. Payments

**Feature:** As an admin, I want to prepare and record weekly payments for staff and expenses so that all outflows are tracked in the ledger.

**UI location:** Ledger page → Payments tab (admin only; staff do not see the tab). Not on the Admin page.

**Period Summary:** Date-range pickers (default: current week Monday → today) load Revenue, Cost, Gross Profit, and Order count via `GET /api/reports/daily-total` — giving context for how much is available to distribute.

**Account balances:** Current Cash and Card balances shown above the distribution form (no extra API call — uses already-loaded ledger balances).

**Distribution modes:** Equal (total ÷ active payees), Weighted (proportional to each payee's `default_weight`, editable inline), Manual (cashier enters each amount). Weighted mode requires payees to have different weights — use the **W** input in Manage Payees to set them.

**Manage Payees:** Collapsible panel to activate/deactivate payees, edit weights, and add new payees with name, type, source account, and weight.

**Default payees:** Pajaro, MonGee, Mon, Paloma, Lola (staff); Rent, Utilities, Capital Payments, Maintenance, Sound Equipment (expense); Savings (savings). Seeded on first run and on test reset.

**Provider Payments:** Below the payee distribution, a **Provider Payments** card handles two cases:
- **Ad-hoc payment** — select any provider, enter amount, pick account (cash/card), optional description; posts an `expense` ledger entry with description `"Provider payment: {name}"` (or custom). `POST /api/providers/:id/payment`.
- **Session bill** — for products with `track_inventory = false` that are linked to a provider via `product_providers`, the system computes `qty_sold × unit_cost` per provider for the selected period. Each provider card shows the breakdown and a confirm button that records the payment. `GET /api/providers/session-bill?from=&to=&tz=`.
- Untracked products are linked to providers via `PATCH /api/products/:id/provider` (admin only). Schema: `product_providers` junction table (`product_id`, `provider_id`). Products view shows a **Link Provider** / **Change Provider** control for untracked, non-supply products (admin only).

| # | Scenario | Description |
|---|----------|-------------|
| 1 | List payees returns default payees | `GET /api/payees` returns the 11 default payees including Pajaro (staff), Rent (expense), Savings (savings). |
| 2 | Create a new payee | `POST /api/payees` adds the payee to the list. |
| 3 | Deactivate a payee | `PATCH /api/payees/:id` with `active: false` marks the payee inactive; it is excluded from payment runs. |
| 4 | Run a payment creates payroll ledger entry | `POST /api/payments/run` for a staff payee creates a `payroll` ledger entry with negative amount. |
| 5 | Run a payment creates expense ledger entry | `POST /api/payments/run` for an expense payee creates an `expense` ledger entry with negative amount. |
| 6 | Run a payment creates savings transfer ledger entry | `POST /api/payments/run` for a savings payee creates a `savings_transfer` ledger entry with negative amount on the source account. |
| 6b | Run a savings payment also credits the savings account | Same run creates a second `savings_transfer` entry with positive amount on the `savings` account. |
| 7 | Update payee default weight | `PATCH /api/payees/:id` with `default_weight: 3` persists the weight; subsequent `GET /api/payees` returns the updated value. |
| 8 | Run payments with a note appends note to ledger description | `POST /api/payments/run` with `note` field; ledger entry description is `"{payee} — {note}"`. |
| 9 | Payment creates a payroll ledger entry (E2E) | Record a payment via API; Ledger page shows a `payroll` entry. |
| 10 | Payment creates an expense ledger entry (E2E) | Record a payment via API; Ledger page shows an `expense` entry. |
| 11 | Payment creates a savings transfer ledger entry (E2E) | Record a payment via API; Ledger page shows a `savings transfer` entry. |
| 12 | Ad-hoc provider payment creates expense ledger entry | `POST /api/providers/:id/payment` with amount and account; `expense` ledger entry created with negative amount and description `"Provider payment: {name}"`. |
| 13 | Ad-hoc provider payment with custom description uses custom description | Submit with explicit `description`; ledger entry uses the provided description. |
| 14 | Set product provider links untracked product to provider | `PATCH /api/products/:id/provider` with `provider_id`; product response includes `provider_id`. |
| 15 | Session bill returns untracked product sales per provider | Create provider, link untracked product, sell it; `GET /api/providers/session-bill` returns that provider with `qty_sold ≥ 2`. |
| 16 | Session bill returns empty array when no provider-linked untracked sales | No provider-linked untracked products; session bill response is `[]`. |
| 17 | Provider Payments section is visible in Payments tab (E2E) | Navigate Ledger → Payments; provider selector, amount input, and Load button are visible. |
| 18 | Ad-hoc provider payment creates expense ledger entry (E2E) | Create provider via API; record ad-hoc payment via UI; Ledger Entries shows `expense` entry. |
| 19 | Card payment auto-applies commission ledger entries | Pay an order with card; two `commission` ledger entries appear — one on `credit_card` (negative, reduces balance) and one on `commissions` (negative, tracks total paid). |
| 20 | Cash payment does not create commission entries | Pay an order with cash; no `commission` ledger entries are created for that order. |
| 21 | Commission rate is configurable | `PATCH /api/admin/commissions` with `rate: 0.05` persists the new rate; subsequent `GET /api/admin/commissions` returns `rate: 0.05`. |
| 22 | Commission settings section is visible in Admin (E2E) | Navigate Admin → Commissions; commission rate input is visible. |

---

## Running the BDD tests

- **Run backend tests only:**
  `cd packages/backend && pnpm test` — 83 scenarios

- **Run frontend tests only:**
  `cd packages/frontend && pnpm test` — 60 scenarios
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
| Payments | backend + frontend | `features/payments.feature` |
| Admin (Register, Users, Discounts, Supplies) | frontend | `features/admin.feature` |
