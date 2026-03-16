# Changelog

All notable changes to Hermes Mercury POS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Tabs

#### "On the Tab" section repositioned to top
- The items already on the tab are now shown at the **top** of the tab detail view, immediately visible without scrolling
- "Add Items" product picker moves below; payment section remains at the bottom

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
