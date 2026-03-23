# Changelog

All notable changes to Hermes Mercury POS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Products

#### Order summary moved to top of Checkout
- The current order (items, quantities, total, Proceed to Payment) now appears above the Add Items section so staff can always see what's in the order without scrolling down

#### Product search filter in Checkout
- A search box above the product list/grid filters products by name as you type (case-insensitive, substring match)
- Clearing the search restores all products instantly — no network request needed
- Works in both grid and list views
- BDD scenario added: "Filter products by name in checkout"

#### Grid view in Checkout
- The "Add Items" section in Checkout now also supports grid/list toggle (⊞ / ☰), defaulting to grid
- In grid mode each product is a tappable card showing name, price, and stock; tapping adds it to the order; cards with items already in the order are highlighted with a blue border and show the current quantity
- The `add-{name}` testid is present in both views so existing checkout tests work unchanged
- View preference persisted to `localStorage` under `checkout-view`
- BDD scenario added: "Switch between grid and list view in checkout"

#### Grid view with list/grid toggle
- Products page now defaults to a **grid layout** — each product shown as a compact card with name, price (editable), cost (editable), and unit count
- A toggle in the top-right switches between grid (⊞) and list (☰) views; the choice is persisted to `localStorage` so it survives page refreshes
- All existing functionality (inline price/cost editing, lock indicator for products in open tabs, add product form) works identically in both views
- BDD scenario added: "Switch between list and grid view" — verifies toggle renders the correct container and product cards are visible in each mode

---

### Infrastructure

#### Database migration script
- Added `pnpm --filter backend migrate` (runs `src/scripts/migrate.ts`) — connects to the PostgreSQL server, creates the target database if it does not exist, then applies the full schema
- Fixes the "database does not exist" error when setting up a fresh local or hosted Postgres instance
- Safe to re-run: all `CREATE TABLE` statements use `IF NOT EXISTS`
- README updated with step-by-step local setup instructions including Docker quickstart and migration command

---

### Reports

#### Cash and card sales breakdown in daily total (fix + feature)
- Fixed a rendering crash in the Daily tab: `cash_sales` and `card_sales` were `undefined` when fetched from an older backend, causing `.toFixed()` to throw and silently prevent the daily section from rendering
- Daily total now shows two additional stat tiles: **Cash** and **Card** — so staff can reconcile the till at a glance
- Backend `GET /api/reports/daily-total` now returns `cash_sales` and `card_sales` fields computed from `payment_method`
- Frontend `DailyTotal` type marks both fields as optional so the view degrades gracefully if the backend is not yet updated
- BDD: new backend scenario "Daily total report breaks down sales by payment method" and new frontend scenario "Daily total shows cash and card breakdown" with `cash-sales` / `card-sales` testid selectors

---

### Ledger

#### Expandable order and tab items on ledger entries
- `sale` and `tab_payment` ledger entries are now tappable rows — tapping expands an inline table showing product name, quantity, unit price, and subtotal for every item in that order or tab
- A small ▼/▲ chevron indicates which entries can be expanded
- Items are loaded on demand and cached; subsequent expands of the same entry make no additional network requests
- Backend: new `GET /api/ledger/:id/items` endpoint — resolves `ref_type` (`order` or `tab`) and `ref_id` from the ledger entry and returns the matching `order_items` or `tab_items` joined with product names
- BDD scenarios: 2 new backend scenarios (sale items, tab payment items) and 1 new frontend scenario (expand sale entry and see item rows)

---

### Tabs

#### Per-item change feedback and live stock in Add Items
- The **quantity** and **subtotal** of each line in "On the Tab" now animate with the same scale-and-colour bump whenever they change — adding, increasing, or decreasing a product triggers the animation on that specific row
- Products are refreshed from the server every time a tab detail view is opened, so the stock counts in "Add Items" are always up-to-date even if another session added items

#### Stock count in Add Items
- Each product row in the **Add Items** section of the tab detail view now shows available stock (e.g. `· 97 in stock`)
- Products with zero stock show **· out of stock** in red and have the **+** button disabled
- Stock count refreshes immediately after every add or quantity change so the number stays accurate while the tab is open
- BDD scenario: stock count is visible and shows "in stock" or "out of stock"

#### Tab inventory tracking
- Adding a product to a tab now decrements `products.units` immediately — inventory stays accurate while the tab is open
- Removing units via the **−** button (or setting quantity to 0) restores the corresponding units back to inventory
- Insufficient-stock requests are rejected with **409** before any change is made, matching the same rule checkout enforces
- Payment does not change inventory a second time — the stock was already decremented when items were added
- Backend: `POST /api/tabs/:id/items` — stock check + `UPDATE products SET units = units - qty` per item added; `PATCH /api/tabs/:id/items/:itemId` — `UPDATE products SET units = units - qtyDelta` (negative delta = restore)
- BDD scenarios: 3 new backend scenarios (stock decremented on add, stock restored on quantity decrease, 409 on insufficient stock)

#### Total change feedback
- Adding or removing a product in Checkout and in a Tab now animates the total with a brief scale-and-colour bump so the user can see the value changed
- The animation plays on the order total in the Checkout view and on both the tab header total and the Pay Tab button amount in the Tab detail view
- No animation on first load — the bump only triggers when the total actually changes

#### Tab detail view section order
- **Pay Tab** is now at the top of the tab detail view for quick access
- **On the Tab** (items list with quantity controls) appears directly below Pay Tab
- **Add Items** product picker is at the bottom

#### Inline quantity editing on tab items
- Each item in the "On the Tab" section now has **−** and **+** buttons to adjust quantity directly
- Tapping **+** increments the quantity by 1; tapping **−** decrements it
- Setting an item's quantity to 0 removes it from the tab entirely
- Tab total updates in real time after each adjustment
- Backend: new `PATCH /api/tabs/:id/items/:itemId` endpoint — accepts `{ quantity }`, recomputes subtotal and tab total atomically; returns updated tab with items
- BDD scenarios: 2 new backend scenarios (update quantity, remove by setting to zero) and 2 new frontend scenarios (increase quantity, decrease to zero)

---


### Admin — PIN Security

#### PIN-protected operations
- Cash-outs from the register now require a PIN before execution
- Closing the register now requires a PIN before execution
- Opening a tab with "Sell at cost (staff drink)" selected now requires a PIN before the tab is created
- Entering an incorrect PIN shows a clear error message inside the PIN dialog; the modal stays open so the user can retry or cancel

#### Admin page
- New `/admin` section accessible from the bottom navigation bar (⚙️ Admin)
- Administrators can change the system PIN by entering the current PIN and confirming a new one (minimum 4 characters)
- Default PIN on first run is `1234`
- Error shown when the current PIN is wrong or the new PINs do not match

#### Backend
- New `settings` table in the database to store key/value system configuration
- `POST /api/admin/pin/verify` — validates a PIN, returns 401 with `{ error: 'Invalid PIN' }` on failure
- `POST /api/admin/pin/change` — changes the PIN; requires correct `current_pin` and a `new_pin` of at least 4 characters
- Migration ensures existing databases receive the `settings` table and default PIN on restart

#### Error handling improvement
- API client now handles non-JSON server responses gracefully — instead of the cryptic browser exception "The string did not match the expected pattern.", errors like `Server error (404) — please check the connection` are shown
- BDD scenarios: 6 new frontend scenarios covering PIN change (success, wrong current PIN, mismatched new PINs) and PIN protection on cashout, register close, and at-cost tab creation

---

### Products

#### Cost modification
- Users can edit a product's cost from the Products view, following the same rules as price modification:
  - Cost must be greater than 0
  - No ledger entry is created for cost changes
  - Cost is locked and cannot be edited while the product is in any open tab — a lock icon replaces the edit button
- Backend: `PATCH /api/products/:id/cost` endpoint added
- BDD scenarios added for backend and frontend: successful update, zero/negative rejection, and lock enforcement

#### Price modification
- `PATCH /api/products/:id/price` endpoint
- Price must be > 0, no ledger entry is created, locked when product is in an open tab

---

### Tabs

#### Add button fix
- **Fix**: The `+` button in the tab detail view now calls the API directly, adding the product immediately
- Previously, clicking `+` only staged the item locally and required a separate "Add to Tab" button — this appeared broken

#### Items display
- The tab detail view now shows an "On the Tab" card listing all added items with product name, quantity, unit price, and subtotal
- The list updates in real time each time a product is added via `+`

#### Tab name in navigation
- **Fix**: The active tab's navigation button now shows the tab's actual name (e.g. "Table 4") instead of the generic "Active Tab" label

#### Multiple open tabs
- Redesigned navigation to properly support multiple simultaneously open tabs:
  - The tab list is now the central hub — open tabs are tappable rows for quick switching
  - Removed the single "active tab" nav slot that implied only one tab could be active
  - "← All Tabs" back button in the detail view returns to the full list
  - Payment state (method, cash amount) resets when switching tabs to prevent cross-tab errors
  - After paying a tab, `loadTabs()` is awaited before returning to the list so the paid tab is removed immediately

#### Tab status stale display fix
- **Fix**: Open tabs were sometimes showing as PAID in the detail view due to two race conditions:
  1. The detail view rendered using stale `selectedTab` data from a previous selection
  2. `loadTabs()` was not awaited after payment, leaving the just-paid tab briefly visible in the open list
- Fixed by switching to the detail view immediately using the list's tab object (status always correct), then loading full item data asynchronously in the background

#### Product grouping in tabs
- **Fix**: Adding the same product multiple times now increments the quantity on a single line instead of creating duplicate rows
- Backend: `POST /api/tabs/:id/items` now upserts — existing product rows have their quantity and subtotal updated in place

#### "Add Items" section repositioned
- The product picker is shown at the top of the tab detail view, immediately visible without scrolling
- "On the Tab" summary appears below the picker; payment section is at the bottom

#### At-cost (staff) tabs
- When opening a new tab, a "Sell at cost (staff drink)" checkbox is available — unchecked by default
- At-cost tabs charge items at `product.cost` instead of `product.price`
- The option cannot be changed once the tab is open
- In the "Add Items" list, products show their cost price labelled "(cost)" so staff know what will be charged before adding
- A prominent **⚠️ STAFF COST PRICE** banner is shown at the top of the tab detail
- Backend: `tabs` table gains an `at_cost` column; `POST /api/tabs/:id/items` branches on `at_cost` to select the correct unit price; existing databases are migrated automatically

---

### Checkout

#### Product grouping
- Adding the same product multiple times shows one order line with an incrementing quantity
- Quantity controls (+ / −) allow adjustment before proceeding to payment

---

### Closed tabs: pagination and paid timestamp

- Closed tabs list is now paginated — 10 entries per page with `← Prev` / `Next →` controls and a "Page X of Y" indicator (controls only rendered when there is more than one page)
- Section title shows the total closed tab count (e.g. `Closed Tabs (47)`)
- Each closed tab entry now shows:
  - Date and time paid (e.g. `Paid 2026-03-11 at 23:42`)
  - Payment method (cash / credit card) below the total
- Page resets to 1 after a tab is paid so the newly closed tab is visible immediately
- `paid_at` field added to the `Tab` TypeScript interface

---

## Earlier

### Added
- Initial project scaffold with pnpm monorepo
- Vite + React + TypeScript frontend
- Express + TypeScript + SQLite backend with 11-table schema
- All 8 feature areas: Products, Register, Checkout, Tabs, Ledger, Reports, Restock, Inventory Adjustment
- Mobile-first React views for all feature areas
- BDD test suites: Cucumber.js + Supertest (backend), Cucumber.js + Playwright (frontend)
- `GET /api/health` endpoint
- Vite proxy from frontend `/api` to backend `:3001`
