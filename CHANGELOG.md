# Changelog

All notable changes to Hermes Mercury POS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

#### Shared ProductPicker component — unified product panel across all views
- Extracted a reusable `ProductPicker` component (`src/components/ProductPicker.tsx`) that replaces the duplicated product listing code that existed independently in Checkout and Tabs
- All three views — **Checkout**, **Tabs Add Items**, and **Products** — now share consistent UI patterns: search input and grid / list toggle
- **Checkout**: no behaviour change; grid/list toggle and search were already present and are now powered by the shared component
- **Tabs Add Items**: now has a **search input** (filters products by name as you type) and a **grid / list toggle** (⊞ / ☰); view preference persisted to `localStorage` under `tabs-add-view`; defaults to list so stock test IDs remain accessible
- **Products**: now has a **search input** (filters the product catalogue by name); grid / list toggle already existed and is unchanged
- Component is fully prop-driven — callers control view mode, search state, price display (`getPrice` / `getPriceNote` for at-cost tabs), add-button test-ID prefix, and stock-span test-ID prefix — so all existing BDD test IDs are preserved without changes

#### "In Stock" filter in product picker
- The Add Items panel in Checkout and Tabs now has a **◈ In Stock** filter toggle (on by default) that hides out-of-stock products (`units ≤ 0`) from the selling UI
- Preference is persisted to `localStorage` under the shared key `product-stock-filter` — toggling in one view carries over to the other
- Filter runs after the Active filter and before the Most Sold sort, so the full pipeline is: active → in-stock → most-sold → render
- No backend changes required — filters entirely on the already-loaded `units` field

#### Product active/inactive status
- Products can now be **deactivated** from the Products view — each card (grid) and row (list) has a **Deactivate / Activate** button (`toggle-active-{id}` testid)
- Inactive products are visually distinguished: 55% opacity and an **INACTIVE** badge; no page reload required — state updates in place
- The Add Items panel in Checkout and Tabs has a new **● Active** filter toggle (on by default) that hides inactive products so they never clutter the selling UI
- Filter preference is persisted to `localStorage` under the shared key `product-active-filter` — toggling it in Checkout carries over to Tabs and vice versa; survives page refreshes and navigation between views
- Filter is implemented with `p.active !== false` so products loaded before the column migration (where `active` is `undefined`) are treated as active — no disruption on first deploy
- Backend: `active BOOLEAN NOT NULL DEFAULT TRUE` column added to `products` (migration-safe `ALTER TABLE … ADD COLUMN IF NOT EXISTS`; existing products default to `true`); new `PATCH /api/products/:id/active` endpoint validates the boolean body and returns the updated product

#### "Most Sold" sort in product picker
- The **Add Items** panel in Checkout and Tabs now has a **↑ Most Sold** toggle button that re-orders products by all-time units sold (descending), so the most frequently ordered items appear first
- Toggle is **on by default** — cashiers immediately see the most popular products without any setup
- Preference is persisted to `localStorage` under the shared key `product-sort`, so toggling it in one view carries over to the other; the setting survives page refreshes and navigation between views
- Products with no sales history fall to the bottom; on a fresh install all products show at zero and the natural list order is preserved
- Sort applies after search filtering — searching "lat" and having Most Sold on shows matching products sorted by popularity
- Backend: new `GET /api/reports/top-products` endpoint — aggregates all-time paid units from `order_items` + `tab_items` per product using subquery joins to avoid double-counting; all products are included (zero-sales products get `units_sold: 0`)
- Sold counts refresh automatically after each completed payment so the sort order stays accurate within a session

#### Database seed script
- New `pnpm seed` script (`packages/backend`) inserts 15 sample products (espresso drinks, cold brew, teas, juices, baked goods) using `ON CONFLICT … DO UPDATE`, making it safe to re-run at any time
- Products include `Espresso` and `Latte` required by the BDD test suite

### Fixed
- OAuth redirect after Google sign-in now correctly lands on the frontend (`pos.el-nido.mx`) instead of the backend URL — fixed trailing-slash mismatch in `trustedOrigins` validation and removed the trailing slash from `callbackURL`
- Fixed "state mismatch" error on Google OAuth — the Better Auth client was making cross-origin requests without `credentials: 'include'`, so the browser discarded the state cookie; added `fetchOptions: { credentials: 'include' }` to `createAuthClient`
- Fixed OAuth state cookie being blocked as third-party by modern browsers — added `/api/:path*` proxy rewrite in the frontend Vercel config so all API calls are same-origin, making auth cookies first-party on `pos.el-nido.mx`

---

## [1.0.0-beta.1] — 2026-03-23

### Authentication & Authorization

#### User profile and sign-out in header
- The app header now shows the signed-in user's profile picture (from Google), initials fallback, display name, and a ⏻ sign-out button on every page
- Tapping the sign-out button ends the session and redirects to `/login`

#### Login with email/password or Google — authorized users only
- The entire app is now protected: unauthenticated users are redirected to `/login`
- **Email + password** and **Sign in with Google** (OAuth) are both supported
- **Access is restricted** — only email addresses pre-added to the `authorized_users` allowlist can sign in; anyone else sees a clear error message regardless of which method they use
- The allowlist is checked on every sign-in (not just first sign-up), so revoking access takes effect immediately on the user's next sign-in
- Powered by **Better Auth** (MIT licence) — sessions stored in Postgres alongside existing data
- New env vars required (see setup notes below):
  - `BETTER_AUTH_SECRET` — random secret for session signing
  - `BETTER_AUTH_URL` — full URL of the backend (e.g. `https://your-app.vercel.app`)
  - `ADMIN_EMAIL` — email seeded as the first admin on fresh installs
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials (Google button hidden if not set)
  - `FRONTEND_URL` — frontend origin for CORS (e.g. `https://your-app.vercel.app`)
- Google OAuth callback URL to register in Google Cloud Console: `{BETTER_AUTH_URL}/api/auth/callback/google`

#### Admin — Authorized Users management
- New **Authorized Users** section in the Admin page (visible to admins only)
- Admin can add a user's email with a role (`staff` or `admin`) before they first log in
- Admin can change a user's role (takes effect immediately — the Better Auth user record is updated)
- Admin can remove a user (they will be blocked on next sign-in)
- Admin page now shows the signed-in user's name, email, and role with a **Sign out** button
- Backend: `GET/POST/PATCH/DELETE /api/admin/users` (admin role required)

---

#### Product image thumbnails
- Each product now has an optional photo thumbnail shown everywhere products appear
- **Products view** — in grid view: 96×96 px thumbnail (centred, editable by tapping); in list view: 56×56 px on the left (also editable)
- **Checkout Add Items** — grid picker: full-width 72 px banner at top of each card; list picker: 40×40 px on the left of each row
- **Checkout order summary** — 36×36 px thumbnail next to each line item
- **Tabs Add Items** — 40×40 px thumbnail on the left of each product row
- **Tabs On the Tab** and **cash payment summary** — 36×36 px thumbnail next to each line item
- In the **create product** form, a photo picker lets the user take a photo with the camera or choose from the gallery before saving
- Tapping any thumbnail (or its placeholder) in the Products view opens the device camera/gallery picker to replace the image
- Images are cropped client-side to a 200×200 px centre-crop JPEG (quality 0.75) before being stored — no server-side processing needed
- Products without an image show a grey 📷 placeholder everywhere
- Backend: `image TEXT` column added to `products` (migration-safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`); `PATCH /api/products/:id/image` endpoint; `POST /api/products` now accepts optional `image` field
- BDD: 2 new backend scenarios (upload image, create with image) and 2 new frontend scenarios (placeholder visible, image shown when set)

#### Close (void) an empty tab
- When a tab has no items the "Pay Tab" card shows a **Close Tab (no charge)** button instead of the payment buttons
- Closing requires a PIN — the existing PIN modal is reused
- Backend: `POST /api/tabs/:id/void` — marks the tab `voided`; returns 409 if the tab has items
- BDD: 2 new backend scenarios (void empty tab, reject void with items) and 1 new frontend scenario (close empty tab with PIN)

#### Shared ReceiptModal component
- Extracted the receipt modal into `src/components/ReceiptModal.tsx` — used by both Checkout and Tabs
- `ReceiptLine` interface exported from the component; callers map their domain lines (checkout `LineItem`, tab `TabItem`) to this neutral type
- Tabs preserve their specific pricing: at-cost tabs show `unit_price` (cost price) in the receipt, not the regular sale price

#### Tab detail section order and stable item list
- **Fix**: Item order in "On the Tab" no longer jumps when adjusting quantities — items are now sorted by ID (insertion order) after every API response
- "On the Tab" is now the first section after the tab header, followed by "Pay Tab", then "Add Items"

#### Cash payment view and receipt modal in Tabs
- Tab payment now mirrors the Checkout flow: "Pay with Card" and "Pay with Cash" buttons replace the old Card/Cash tab selector
- "Pay with Cash" transitions to a dedicated cash payment view showing the tab name, item breakdown, total due, live change calculation, and a Confirm button
- After paying a tab (card or cash), the same `ReceiptModal` used in Checkout is shown with timestamp, itemised items, total, and change due
- Closing the receipt modal returns to the tabs list
- BDD scenarios added: cash shows live change, receipt shown after card/cash, receipt has order items, close returns to list

#### Cash payment view with live change calculation and receipt modal
- Clicking "Pay with Cash" transitions to a dedicated cash payment view showing the order summary and a cash-received input
- Change due is calculated live as the cashier types — shown in green when sufficient, red when short
- "Confirm Payment" is disabled until cash received ≥ order total
- After any payment (card or cash) a receipt modal appears showing: timestamp, itemised order (name, quantity, unit price, line total), subtotal, total, and change due for cash sales
- Receipt modal includes placeholder **Print** and **Email** buttons (not yet wired up) for future use
- Closing the modal clears the order and resets to a fresh state
- BDD scenarios added: cash payment live change, receipt modal content, close to start new order

#### Order summary moved to top of Checkout
- The current order (items, quantities, total, and payment controls) now appears above the Add Items section so staff can always see what's in the order without scrolling down

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

## [0.1.0] — Initial scaffold

### Added
- Initial project scaffold with pnpm monorepo
- Vite + React + TypeScript frontend
- Express + TypeScript + SQLite backend with 11-table schema
- All 8 feature areas: Products, Register, Checkout, Tabs, Ledger, Reports, Restock, Inventory Adjustment
- Mobile-first React views for all feature areas
- BDD test suites: Cucumber.js + Supertest (backend), Cucumber.js + Playwright (frontend)
- `GET /api/health` endpoint
- Vite proxy from frontend `/api` to backend `:3001`
