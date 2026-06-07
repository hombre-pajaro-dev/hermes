# Changelog

All notable changes to Hermes Mercury POS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

#### Reopen closed session (admin)
- New `POST /register/sessions/:id/reopen` endpoint (admin only) to reopen the most recently closed register session.
- Guards: rejects if another session is already open (409), if the target session is not the most recently closed (409), or if the session isn't found (404).
- On success: deletes the `register_close` ledger entry for the session and clears `closing_cash`, `closed_at`, and `inventory_snapshot_close`, returning the session to `open` status.
- 3 BDD scenarios added (129/129 passing).

### Fixed

#### Register close — expected cash now uses ledger cash balance
- The previous expected-cash formula (`opening_cash + cash_orders + cash_tabs − cashouts − linked_payments`) missed any `account_adjustment` ledger entries against the cash account, as well as cash payment runs not explicitly linked to the session via `session_id`. This caused the variance shown at close to be wrong when manual ledger adjustments had been made during the session.
- At close time, expected cash is now `SELECT SUM(amount) FROM ledger_entries WHERE account = 'cash'` — the running ledger cash balance, which captures every cash movement (sales, tab payments, cashouts, payment runs, and account adjustments).
- The `register_close` ledger entry's stored variance is authoritative. Session report and close-brief now derive expected cash for closed sessions from it (`closing_cash − variance`) rather than re-computing from the session formula.

### Added

#### Session Report — Unclaimed Payments (retroactive session linking)
- Session report for closed sessions now surfaces any payroll/expense/savings entries that were recorded during the session's time window but have no session link (orphaned entries from before the auto-link fix).
- Each unclaimed entry shows with an **Add** button. Clicking it calls `POST /register/sessions/:id/claim-payments` and refreshes the report — the entry moves from the unclaimed list into the regular Payments section.
- New backend endpoint `POST /register/sessions/:id/claim-payments` (admin only) sets `session_id` on ledger entries that are currently unlinked.
- 2 new BDD scenarios + `getDb()` helper added to PosWorld for test-only DB setup (126/126 passing).

#### Session Report — P&L Summary and PDF export
- New **P&L Summary** card at the bottom of each session report showing all financial flows in a single table: order revenue, tab revenue, COGS, card commissions, gross profit, payroll, expenses, write-offs, inventory adjustment value, and **Net Session Result** (positive = profit, negative = loss).
- Tab revenue and tab COGS were previously excluded from the session report's revenue/profit figures — the P&L now includes the complete picture.
- **Print / Save as PDF** button at the bottom of each session report. Uses the browser's native print dialog with `@media print` styles that hide navigation and format the report for paper.
- 3 new BDD scenarios (125/125 passing).

#### Session Reconciliation — post-close physical count and digital balance entry
- New `PATCH /register/sessions/:id/reconcile` endpoint (admin only) accepts physical product counts and an actual digital balance after the session is closed.
- Session report returns `active_products` — the subset of unit-tracked products sold, tabbed, or restocked during the session — each with system expected count, physical count (if entered), unit delta, and financial value of the discrepancy (delta × price).
- Session report returns `actual_digital`, `digital_variance` (actual − expected) once a digital balance is entered.
- Digital Reconciliation card in the session report now shows actual vs expected with a variance label when reconciled.
- New inline **Reconciliation** card in the session report (closed sessions only): editable physical count per active product with live delta and value preview, plus an Actual Digital Balance field. Save button calls the reconcile endpoint and refreshes the report.
- Physical counts are fully updatable — re-submitting a count for a product replaces the previous entry.
- 4 new BDD scenarios (122/122 passing).

### Changed

#### Tabs — Session-scoped (breaking design change)
- Tabs are now exclusively owned by the session they were opened in. A tab can only be paid while its session is open.
- **Session close is hard-blocked** if any open tabs exist. The backend returns 409 with the full list of blocking tabs (name + total). Previously any session could be closed regardless of open tabs.
- Tab creation now requires an **open** session. Previously it linked to the most recent session even if closed (bug).
- Voiding a tab with items is now allowed (admin only) as a write-off. Records a `tab_writeoff` ledger entry so the loss is visible in the session report.
- Register view now shows a **proactive warning card** listing open tabs with totals. The Close Register button is disabled until all tabs are paid.
- `expected_cash` and `expected_digital` formulas simplified to use `session_id` for tabs (no more `paid_at` time-window).
- 3 new BDD scenarios covering the hard block, open-session enforcement, and write-off (118/118 passing).

### Fixed

#### Session Report — Transfer sales and digital reconciliation
- Session report now tracks `transfer_sales` separately (previously lumped with card under digital, but not shown).
- New **Digital Reconciliation** card in the session report shows `expected_digital`: card + transfer inflows minus card commissions and digital-sourced payouts.

#### Session Report — Cash reconciliation now accounts for session payments
- `expected_cash` in the session report (and close-brief) now subtracts cash-sourced payroll, expense, and savings_transfer payments linked to the session. Previously, paying staff in cash during a session caused a false negative cash variance.

#### Distribute Payments — Session selector now includes the open session
- The "Link to session" dropdown in Distribute Payments now shows all sessions (open and closed), not just closed ones. Defaults to the currently open session when present, so payments made during an active shift are linked correctly.

### Added

#### Payments — Transfer payment method
- New **Pay with Transfer** button in Checkout and Tabs (one-tap, no amount-received input). Records payment as `transfer` method.
- Transfer revenue posts to the **Digital** account — the same bank account as card payments — with no commission deducted.
- Available to both staff and admin.

#### Products — Staff Price per product
- Each product now has a **Staff Price** — the price charged to staff on at-cost tabs.
- Admins can edit staff price inline in the Products view (alongside price and cost).
- A **markup %** label is shown next to each price and staff price field, showing how much above cost the price is: `(price − cost) / cost × 100`.
- New products are seeded with staff price equal to cost (0% markup baseline).

### Added

#### Register — Physical Count Close
- The close register form now includes a **Physical Count** table showing all active, unit-tracked products. Each row defaults to the system's current unit count; the cashier only edits the ones that differ.
- On submit, any product where the physical count differs from the system count automatically creates an **Inventory Adjustment** (stock corrected, ledger entry posted).
- Discrepancies are visible in the session report's Inventory Activity section alongside system-expected counts.

#### Register — Session Payments
- Payments (payroll, expense, savings transfers) can now be **linked to a register session** by passing `session_id` when running `POST /payments/run`.
- The session report (`GET /register/sessions/:id/report`) now includes a `payments` array listing all payment entries tagged to that session.
- The Ledger → Payments tab shows a **Link to session** dropdown (pre-selecting the most recently closed session) so payments run after close are automatically attributed.
- Session report displays a **Payments** card listing each entry with payee name, type badge, amount, and timestamp.

### Fixed

#### Payments — savings transfer now credits the savings account
- `POST /payments/run` for a savings payee now inserts two ledger entries: a debit on the source account and a matching credit on the `savings` account.
- Previously only the debit was recorded, leaving the savings account balance unchanged.

#### Register — closing cash reconciliation includes cross-session tab payments
- `POST /register/close` and `GET /register/sessions/:id/report` now scope tab cash payments by `paid_at` (the time the tab was actually paid) rather than by `session_id` (the session the tab was opened in).
- Previously, a tab opened on day 1 and paid in cash on day 2 was excluded from the expected-cash formula, producing a phantom "cash over" entry on the ledger at close time.

### Changed

#### Ledger — "Credit Card" account renamed to "Digital"
- The `credit_card` ledger account is now called **Digital**, covering both card and transfer revenue.
- All UI labels updated: balance cards, dropdowns, and commission breakdown now show "Digital" instead of "Card".
- Existing ledger data migrated automatically on startup.

#### Products — At-cost tab uses staff price
- At-cost (staff) tabs now price items at **staff price** instead of raw cost.
- The price note in the tab panel changed from `(cost)` to `(staff)`.

### Fixed

#### Reports — date filters persist across tab navigation, reset next day
- **By Item** and **Range** tab date inputs are saved to localStorage on every Apply click, keyed `reports-sales-from/to` and `reports-range-from/to`.
- On mount each tab restores the saved values only if they were saved today (local timezone); otherwise falls back to today's default range. No stale dates carried over to the next business day.

#### Ledger — card commission no longer appears as two separate entries
- The `credit_card` commission ledger entry now uses `entry_type = 'commission_transfer'` instead of `'commission'`, distinguishing it from the expense record on the `commissions` account.
- **LedgerView** groups the pair into a single "commission transfer" row with account shown as `credit_card → commissions`, eliminating the confusing double-entry display. Report queries are unaffected — they continue to filter `entry_type = 'commission' AND account = 'commissions'`.
- **Migration** in `schema.ts` renames all existing `commission` rows on the `credit_card` account to `commission_transfer` on startup.
- **BDD test** updated: the credit_card step now asserts `entry_type = 'commission_transfer'`; the cash-payment check covers both types.

### Added

#### Reports — datetime range filtering and shared DateTimeRangeFilter component
- **By Item and Range tabs** now use `datetime-local` inputs instead of `date` inputs, allowing filtering by time of day (e.g. 08:00–14:00), not just by date.
- **Apply button** added to By Item tab (Range already had one). Both tabs now fetch only on Apply click; By Item no longer auto-fetches on input change.
- **`DateTimeRangeFilter` component** (`packages/frontend/src/components/DateTimeRangeFilter.tsx`) — shared component used by both tabs. Manages internal draft state; calls `onApply(from, to)` on Apply. Defaults to today at `00:00`–`23:59`.
- **Backend SQL** for `/reports/sales-by-item`, `/reports/daily-total`, and `/reports/inventory-adjustments` changed from `::date BETWEEN` to timestamp comparison: `(paid_at AT TIME ZONE tz) BETWEEN from::timestamp AND to::timestamp`.
- **Backend `/reports/daily-range`** rewritten with continuous-window semantics (ADR-0002): first day uses the `from` time as lower bound, last day uses the `to` time as upper bound, middle days are shown in full.
- **ADR-0002** added: documents the continuous-window semantics for multi-day datetime ranges in the Range report.
- **BDD:** 4 new backend scenarios (time precision for sales-by-item, time bounds for daily-range); 2 new frontend scenarios (Apply button + datetime inputs on By Item tab, Apply button on Range tab).

### Changed

#### Checkout — responsive layout and inline cash payment
- **Tablet (≥1024px):** Fixed 60/40 split — product picker left, cart panel right, always visible. Left panel dims and disables pointer events while cash input is open to prevent accidental adds during handoff.
- **Phone (<1024px):** Product picker fills screen. A sticky bar at the bottom (appears on first item add, shows item count + total) opens a full-screen cart panel. Cart closes with the ← Back button.
- **Inline cash payment (Checkout + Tabs):** "Pay with Cash" now expands a cash-received input and live change display inline in the cart footer — no page navigation. Replaced the `step`/`payStep` full-screen swap with `cashExpanded` boolean.
- **BDD test viewport** changed from Pixel 5 (393px) to 1024×768 so all existing test IDs remain directly accessible in the split layout.
- `data-testid="checkout-cart-bar"` — new sticky bar button on phone.
- Removed: `data-testid="cash-payment-view"` (checkout full-screen step) and `data-testid="tab-cash-payment-view"` (tabs full-screen step); cash section is now inline.

### Added

#### Register Open/Close Variance Model
- Opening the register no longer injects the full `opening_cash` into the cash ledger account; instead only the **variance** (`opening_cash − current cash balance`) is recorded. A balanced open records 0; an over-count records a positive amount; a short records a negative amount.
- Closing the register no longer withdraws `closing_cash` from the ledger; instead only the **variance** (`closing_cash − expected_cash`) is recorded. Expected cash = `opening_cash + cash order sales + cash tab payments − cashouts`.
- Session report (`GET /api/register/sessions/:id/report`) now includes `expected_cash` and `cash_variance` fields for cash reconciliation.
- BDD: 5 new backend scenarios (open records variance, close balanced/short/over, session report fields)

#### Account Transfers
- Admins can move money between ledger accounts (e.g. cash → credit card) without creating an external payment
- **API:** `POST /api/ledger/transfer` — admin-only; accepts `from_account`, `to_account`, `amount`, optional `description`; creates two `transfer` ledger entries (debit on source, credit on destination); description defaults to `"Transfer {from} → {to}"`
- **UI:** "Transfer Between Accounts" card in Ledger → Balances tab; From/To account selectors, amount input, optional description, Transfer button
- BDD: 2 new backend scenarios (transfer creates debit + credit, same-account rejected)

#### Commission Visibility and Profit Impact
- **Ledger → Balances:** Credit Card breakdown card shows gross received, commissions paid (amber), and net balance; main balances list filters out the internal `commissions` account
- **Ledger → Payments → Period Summary:** Commissions line (amber) appears when > 0 for the selected period; "Gross Profit" renamed to "Profit"; profit calculation subtracts commissions
- **Reports → By Item:** Profit stat subtracts commissions for the selected period
- **Reports → Brief:** Commissions stat and Cash Reconciliation card (expected cash vs. variance) added to the session brief
- **Reports → Sessions:** Commissions stat and Cash Reconciliation card (expected / counted / variance) added to per-session view

#### Credit Card Commission Tracking
- Card payments now automatically deduct a commission from the `credit_card` account balance (so the balance reflects net received) and record it in a separate `commissions` account (so total charged is visible)
- Default rate: 3.5% + 16% IVA on the commission — configurable by admin
- Admin → Commissions tab: view and edit commission rate and IVA rate; see cumulative total commissions paid; `GET/PATCH /api/admin/commissions`
- Commission entries appear in Ledger Entries with type `commission` (amber color); automatically created for card orders and card tab payments
- Set rate to 0 to disable commission tracking entirely
- Per-payee account override in Distribute Payments: each payee row now has a dropdown to pick cash or card for that payment run (overrides their stored default)
- BDD: 3 new backend scenarios (auto-applied on card, not on cash, rate configurable); 1 new frontend E2E scenario (settings visible in Admin)

#### Provider Payments
- Admins can record payments to providers directly from the Ledger → Payments tab (admin-only)
- **Ad-hoc payment:** provider picker, amount, account (cash/card), optional description → `expense` ledger entry; description defaults to `"Provider payment: {name}"`; `POST /api/providers/:id/payment`
- **Session bill:** for products with `track_inventory = false` linked to a provider, the system auto-calculates `qty_sold × unit_cost` per provider for the selected period; each provider card shows a product breakdown and a confirm button that records the payment as an `expense` ledger entry with description `"Session bill: {name}"`; `GET /api/providers/session-bill?from=&to=&tz=`
- Products with `track_inventory = false` can now be linked to a provider via a **Link Provider** control on the Products view (admin only); `PATCH /api/products/:id/provider`
- Schema: new `product_providers` junction table (`product_id`, `provider_id`) — 1:1 in practice but N:N-ready for future
- Products API (`GET /api/products`) now includes `provider_id` and `provider_name` fields (null when not linked)
- BDD: 5 new backend scenarios (ad-hoc payment, custom description, set provider, session bill, empty bill); 2 new frontend E2E scenarios (section visible, ad-hoc payment via UI)

---

## [1.0.0-beta.4] — 2026-04-25

### Added

#### Products view — tab-reserved stock indicator
- Each product card and list row now shows an amber "X in open tabs" label when units are reserved across active tabs
- Count is the sum of that product's quantity across all currently open tabs
- Visible to all roles; shown only when quantity > 0; uses `data-testid="tab-reserved-{id}"`
- No backend changes — aggregated client-side from the existing tab detail fetches already performed on load

#### Products view — admin-only editing
- All product mutation controls are now hidden from staff: Add Product button, price/cost Edit buttons, Activate/Deactivate, Enable/Disable tracking, Edit/Link Supplies, and image picker
- Staff see the product catalogue in read-only mode — static price/cost values, plain product image (no click-to-change), no action buttons
- No backend changes — `requireAdmin` already enforces mutations server-side; this closes the frontend gap
- Docs: scenario 17 added to Products section

#### Restock ledger entries are now expandable
- `restock` added to the expandable entry types in the Ledger Entries tab (alongside `sale` and `tab_payment`)
- `GET /api/ledger/entries/:id/items` now handles `ref_type = 'restock'` — returns restocked products with name, quantity, unit cost, and subtotal from `restock_items`
- Expanding a restock entry shows the same product/qty/unit/subtotal table used for sales and tab payments
- BDD: 1 new backend scenario (restock entry items); 1 new frontend E2E scenario (expandable restock entry in ledger)

#### Restock — provider, per-item unit cost, and payment tracking (admin only)
- Restock is now **admin-only** (`requireAdmin` on `POST /api/restock`)
- New **`providers`** table and `GET/POST /api/providers` endpoints to manage restock suppliers
- `restock_orders` gains `provider_id`, `payment_amount` (calculated), `payment_account`; `restock_items` gains `previous_cost`
- `POST /api/restock` now accepts `unit_cost` per item: if it differs from `product.cost`, `products.cost` is updated and the old value stored as `previous_cost` in `restock_items`
- `payment_amount` is auto-calculated server-side as Σ(qty × unit_cost); no longer sent from the client
- `restock` ledger entry carries the real (negative) payment amount and the selected account; description reads `Restock from {provider_name}`
- **UI — Purchase Details card:** Provider combobox (find or create as you type), Pay from Account selector
- **UI — Product rows:** "Total paid ($)" input per product; unit cost derived read-only as total ÷ qty; amber warning when derived unit cost differs from stored cost; auto-computed total displayed before submit
- **UI — Ledger expanded restock row:** Amber "was $X.XX" badge on any item where the paid unit cost differed from the stored cost at time of restock
- Non-admin users see an "Admin access required" message instead of the restock form
- BDD: 4 new backend scenarios; 4 new frontend E2E scenarios

#### Ledger entry enrichment for tab payments
- `GET /api/ledger` now JOINs the `tabs` table for `tab_payment` entries; response includes `tab_at_cost` and `tab_opened_by`
- **COST badge:** purple inline badge shown on any `tab payment` row when the tab was opened at cost — visible to all users
- **Opened by (admin only):** shows who created the tab below the description on `tab payment` rows
- **Contextual actor labels (admin only):** `tab_payment` → "paid by", `payroll`/`expense`/`savings_transfer` → "recorded by", others → "by"
- Bugfix: entry type label now uses `replace(/_/g, ' ')` (was `replace('_', ' ')`) — multi-underscore types now render fully (e.g. `savings transfer`, `account adjustment`)
- BDD: 2 new backend scenarios (`tab_at_cost` flag, `tab_opened_by` field); 1 new frontend E2E scenario (COST badge visible)

#### Account Adjustment (admin only)
- Admins can manually add or remove money from any ledger account (cash, credit_card, etc.) with a required description
- **API:** `POST /api/ledger/adjustment` — admin-only; creates an `account_adjustment` ledger entry; positive amount = credit, negative = debit
- **UI:** "Account Adjustment" card in Ledger → Balances tab; account selector, Add/Remove toggle, amount and description inputs; balances and ledger entries refresh on submit
- BDD: 2 new backend scenarios ("Admin can add money to an account via adjustment", "Admin can remove money from an account via adjustment"); 1 new frontend E2E scenario ("Admin sees account adjustment form in Balances tab")

#### Audit trail (admin-only)
- Every significant action now records **who did it** in the database
- **New columns:** `tabs.created_by`, `tabs.paid_by`, `tab_items.added_by`, `tab_items.added_at`, `orders.created_by`, `orders.paid_by`, `ledger_entries.created_by`
- All values are the authenticated user's email; `NULL` for actions taken in test mode or by unauthenticated requests
- **Tab detail view (admin only):** "Opened by {email}" shown in the header; each item in "On the Tab" shows who added it and when
- **Tab list (admin only):** Open tab rows show the opener's email; closed tab rows show "by {email}" under the paid timestamp
- **Ledger entries (admin only):** Each entry shows "by {email}" if present — covers sales, tab payments, and payroll/expense/savings runs
- Shared helper `src/lib/actor.ts` extracts `req.session?.user?.email` with safe `null` fallback for test mode

### Changed

#### PIN security replaced by RBAC
- Removed the global PIN system entirely — no more `PinModal`, `/admin/pin/verify`, or `/admin/pin/change`
- Operations previously gated by PIN are now controlled by user role:
  - **Cash Out** — admin only (backend: `requireAdmin` on `POST /api/register/cashout`)
  - **Close Register** — admin only (backend: `requireAdmin` on `POST /api/register/close`)
  - **Void Tab** — admin only (backend: `requireAdmin` on `POST /api/tabs/:id/void`)
  - **At-cost Tab** — any authenticated staff member (PIN restriction removed)
  - **Admin-only courtesy discounts** — discounts marked `requires_pin` are now visible only to admins (`isAdmin` check in CheckoutView and TabsView); the field label changed from "Requires PIN" to "Admin only"
- `PinModal` component deleted; `verifyPin` and `changePin` removed from `api/client.ts`
- Admin submenu: **PIN** tab removed; only Register, Discounts, Supplies, Users remain
- `RegisterView` hides Cash Out and Close Register cards from non-admin users
- Backend: shared `requireAdmin` middleware in `src/middleware/require-admin.ts` — bypasses in `NODE_ENV=test` to preserve all BDD test behaviour
- BDD tests: removed all 7 PIN-related E2E scenarios; "Close an empty tab" no longer enters a PIN; new admin feature scenarios test Register section and Discounts navigation

### Added

#### Tab last-updated timestamp
- `updated_at TIMESTAMPTZ` column added to the `tabs` table; set to `NOW()` on every mutation: create, add items, update item quantity, pay, void
- Migration: `ALTER TABLE tabs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ` + one-time backfill `SET updated_at = created_at WHERE updated_at IS NULL`
- **Open tab list row:** shows "Updated {date time}" below the items summary
- **Closed tab list row:** shows "Updated {date time}" between the items summary and the "Paid" date
- **Tab detail header:** shows "Updated {date time}" inline with the status badge
- `Tab` type in `api/client.ts` gains `updated_at?: string`
- BDD: 2 new backend scenarios (updated_at set on add-items, advanced on qty update); 2 new frontend E2E scenarios (timestamp visible in list and detail)

### Changed

#### Payments moved to Ledger; admin section restructured with submenu
- Payments panel moved from **Admin → Payments** to **Ledger → Payments tab** (admin-only; hidden from staff)
- Admin section now uses a tabbed submenu — **Register**, **PIN**, **Discounts**, **Supplies**, **Users** — eliminating the need to scroll through unrelated sections
- Payments tab in Ledger opens with a **Period Summary** card: date-range pickers (default Monday → today) fetch `GET /api/reports/daily-total` and display Revenue, Cost, Gross Profit, and Order count for the period — giving context before entering payment amounts
- Current **Cash** and **Card** account balances shown at the top of the Payments tab (from existing `GET /api/ledger/balances` — no extra request)
- After recording payments, ledger entries and balances refresh automatically
- Weighted distribution mode now functional end-to-end: `default_weight` per payee is editable inline in Manage Payees; new-payee form exposes a weight input (previously always defaulted to 1 with no UI to change it)

### Added

#### Payments
- Admin section to prepare and record weekly payments for staff and expenses
- Default payees seeded on startup: Pajaro, MonGee, Mon, Paloma, Lola (staff); Rent, Utilities, Capital Payments, Maintenance, Sound Equipment (expense); Savings (savings account)
- Three distribution modes: **Equal** (total ÷ active payees), **Weighted** (proportional to each payee's `default_weight`), **Manual** (cashier enters each amount)
- Live total preview updates as amounts are entered
- Manage Payees panel (collapsible): activate / deactivate payees, add new payees with type (staff / expense / savings) and source account (cash / card)
- Payment recording creates ledger entries per payee: `payroll` for staff, `expense` for expenses, `savings_transfer` for savings — each with negative amount to reflect outflow from the source account
- New `savings` account in the ledger accounts table for tracking savings transfers
- API endpoints: `GET /api/payees`, `POST /api/payees`, `PATCH /api/payees/:id`, `DELETE /api/payees/:id`, `POST /api/payments/run`
- BDD: 8 backend scenarios in `payments.feature` (adds weight update and payment-with-note); 3 frontend e2e scenarios in `payments.feature` (verifying ledger entries after payment runs); 1 new frontend scenario in `admin.feature` (submenu PIN navigation)

### Added

#### Tab item summary in tabs list
- Each tab row in the open and closed tabs list now shows a one-line item summary (e.g. `Latte ×2 · Espresso ×1`) without opening the tab
- Up to 4 items shown inline; additional items shown as `+N more`; empty tabs show `Empty`
- `GET /api/tabs` now JOINs `tab_items` and `products` and returns an `items` array on every tab — no extra API calls needed
- `Tab` type gains optional `items?: TabItem[]`; `TabItem` gains optional `name?: string`
- BDD: new backend scenario "Tab list includes items for each tab"; new frontend scenario "Tab list shows item summary without opening the tab"

#### Register sessions report
- New **Sessions** tab in Reports: select any register session from a dropdown and view an orders-only breakdown (tabs excluded by design — they span multiple sessions)
- Session detail shows: opened/closed timestamps, opening/closing cash, orders count, revenue, cash sales, card sales, cost, profit
- **Inventory activity table**: when snapshots exist, shows opening units vs closing units per product alongside units sold, restocked, and adjusted in the session
- Sales by product breakdown with units, revenue, cost, and profit per item
- Cash removals (cashouts) list for the session
- A notice on the UI states: *"Tab sales are not included — tabs may span multiple sessions and are tracked separately."*
- `POST /register/open` now captures a snapshot of all active product units and supply quantities (`inventory_snapshot_open` JSONB on `register_sessions`)
- `POST /register/close` captures the same closing snapshot (`inventory_snapshot_close`)
- `GET /api/register/sessions` — lists all sessions ordered by opened date descending
- `GET /api/register/sessions/:id/report` — returns session metadata, orders-only sales summary, by-item breakdown, cashouts, restocked quantities, and inventory adjustments for that session
- Schema: `ALTER TABLE register_sessions ADD COLUMN IF NOT EXISTS inventory_snapshot_open JSONB` and `inventory_snapshot_close JSONB`
- BDD: 5 new backend scenarios (sessions list, orders-only report, tab exclusion, opening snapshot, closing snapshot); 2 new frontend scenarios (session selector visible, tab exclusion notice visible)

#### Product inventory tracking toggle
- Products can be marked as **untracked** (`track_inventory: false`) — for items where stock counting has no operational value (e.g. beverages managed by a separate provider module in future)
- Untracked products are always sellable: ◈ In Stock filter never hides them; the + button is never disabled regardless of `units` value
- Selling an untracked product does not decrement `products.units` or deduct from linked supplies
- Untracked products are excluded from Restock and Inventory Adjustment views; API rejects them with a clear error if submitted
- Sold quantities are still recorded in `order_items` / `tab_items` — revenue and sales reports are unaffected
- Products view shows `NO TRACK` badge and "∞ units" display; toggle button **Disable / Enable tracking** per product (non-supply products only)
- API: `PATCH /api/products/:id/track-inventory` with `{ track_inventory: boolean }`
- Schema: `ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT TRUE`

### Changed

#### Tabs can be opened without an open register
- `POST /tabs` no longer requires the register to be open — tabs are long-lasting and span multiple sessions
- The new tab is linked to the most recent register session (open or closed); if no session has ever been created, a 409 is returned with a clear message
- Removed `requireOpenRegister` middleware from the tab creation route
- BDD: new scenario "Can open a tab when register is closed" (scenario 16 in Tabs)

#### Register close no longer blocked by open tabs
- `POST /register/close` previously rejected with 409 when any tabs linked to the session were still open
- Removed this restriction — tabs are long-running by design and often outlive a register session; closing the register is now always permitted
- BDD: updated backend scenario "Cannot close register while tabs are open" → "Can close register with open tabs"

### Added

#### Historic report
- New **Historic** tab in Reports with three groupings: **Weekly** (last 12 weeks, default), **Monthly** (full year), **Daily** (Jan 1 → today)
- SVG column chart with three bars per period (Revenue / Cost / Profit); best period highlighted with ★ and golden glow
- Daily view shows a single revenue bar per day with a dashed median line computed over days that had sales
- Best-period summary card below the chart (revenue, cost, profit, order count)
- Daily view adds a Median card showing median revenue / cost / profit across all sale days
- `GET /api/reports/historic?groupBy=week|month|day&tz=&year=` — returns periods with revenue, cost, profit, order count, best period index, and median stats for day view

#### By Weekday report
- New **By Weekday** tab in Reports showing median revenue / cost / profit for each day of the week (Mon–Sun)
- Uses `PERCENTILE_CONT(0.5)` computed over all days with sales in the current year
- Chart (7 grouped bars) + best-day card + ranked table with sample count per weekday
- `GET /api/reports/by-weekday?tz=&year=` endpoint

### Fixed

#### Card sales always showing $0.00 in reports
- Tabs were storing `payment_method = 'credit_card'` while orders stored `'card'`; the `daily-total` report filtered on `'card'` so all tab card payments were invisible
- Both routes now store the raw `payment_method` value (`'card'`) — consistent across orders and tabs

#### Ledger timestamps showing UTC instead of local time
- `created_at` was sliced as a raw UTC string (`2026-04-18T23:30` displayed as-is); now converted to browser local timezone via `toLocaleString` with `Intl` timezone

#### Daily range report missing tab payments
- `GET /api/reports/daily-range` only queried the `orders` table; tab payments were silently excluded from both revenue and cost
- Both sub-queries now UNION ALL with `tabs` / `tab_items`

### Infra

- `packages/backend/src/scripts/seed-orders.ts` — dev utility to seed 14 weeks of realistic historical order data for chart testing
- `README.md` updated: correct Docker container name (`hermes-db`), credentials (`hermes/hermes`), env var name (`DATABASE_URL`), and added `docker start hermes-db` for subsequent starts

---

## [1.0.0-beta.3] — 2026-04-17

### Added

#### Cart-aware stock availability in Checkout
- The **Add Items** picker in Checkout now reflects supply consumption from the current cart in real time — no network calls needed
- For **supply-based products**: as soon as a product is added to the cart, all other products that share any of the same supplies immediately show reduced availability; the picker's stock label, disabled state, and ◈ In Stock filter all update instantly
- For **unit-based products**: the picker shows `server units − cart quantity`, so it always indicates how many more of that product can still be added
- The **+** button in the order summary is also gated on cart-aware availability, preventing the cashier from incrementing a line beyond what stock allows
- After each payment, `products` and `supplies` are refreshed together so the next order starts from accurate server-side state
- New pure utility function `src/lib/cart-utils.ts → computeCartAwareProducts(products, supplies, cart)` — computes the adjusted units array from already-loaded state with no side effects

#### Supplies module
- New **Supplies** entity: each supply has a name, a unit label (e.g. `g`, `ml`, `units`), and a current quantity
- Products can now be **supply-based**: link a product to one or more supplies and specify how much of each supply is consumed per unit sold (e.g. "Espresso" uses 20 g of "Coffee grounds")
- Products that are not linked to any supply continue to track stock directly via `product.units` — existing behaviour is fully preserved
- **Computed stock**: for supply-based products, available units are computed server-side as `floor(min(supply.quantity / qty_per_unit))` across all ingredients; the same computed value is returned by every `GET /api/products` response so the rest of the app requires no changes
- **Stock deduction on sale**: when an order or tab item is paid/added, deductions go to the underlying supplies (not product.units) for supply-based products; unit-based products continue to decrement `products.units` as before
- **Tab quantity changes**: increasing or decreasing a tab item for a supply-based product adjusts supply quantities proportionally
- **Restock blocked for supply-based products**: attempting to directly restock a supply-based product returns a 400 error with a clear message directing the user to restock via the supply
- **Inventory adjustment blocked for supply-based products**: physical-count adjustments are rejected for supply-based products for the same reason
- `GET/POST/PATCH/DELETE /api/supplies` — full CRUD for supplies; `DELETE` blocked if any product uses the supply
- `POST /api/supplies/:id/restock` — adds quantity to a supply
- `PATCH /api/products/:id/supplies` — replaces the supply ingredient list for a product (empty array reverts to unit-based)
- `POST /api/products` accepts optional `supply_ingredients` to link supplies at creation time
- **Admin → Supplies card** (admin-only): create/edit/delete supplies; shows current quantity and unit
- **Products view**: supply-based products show a `SUPPLY` badge and list their ingredients (e.g. `20g Coffee grounds`); each product has an "Edit Supplies" / "Link Supplies" button for inline ingredient editing (supply picker + qty per unit); the create-product form has a "Uses supplies" checkbox that replaces the units field with an ingredient picker
- **Restock view**: split into two sections — **Products** (unit-based products only, existing direct restock) and **Supplies** (all supplies with quantity inputs); both are submitted with a single button

#### Discount engine
- New discount module with two types: **Percentage** (X% off a set of products or the whole order) and **Buy X Get Y Free** (every N qualifying items = cheapest M are free, mixed products allowed)
- Discounts are configured in **Admin → Discounts** (admin-only); each discount defines its reward, qualifying products, trigger conditions, and optional limits
- **Auto-discounts** activate automatically when conditions match (day of week, date range, redemption cap); the discount with the highest savings is applied; cashier can remove it with ✕
- **Manual / courtesy discounts** (`is_manual = true`) are never auto-applied; cashier triggers them via a "🎁 Apply courtesy…" button, optionally protected by PIN
- **At-cost tabs** are mutually exclusive with discounts — the discount bar is replaced by a "Staff price active — discounts unavailable" notice
- **One discount per order**: auto-discount is pre-selected; manual override replaces it; only one can be active at a time
- Discount shows as a named line item between Subtotal and Total in both the order card and the receipt (`🏷 Martes Feliz −$3.70`)
- Server re-validates discount eligibility at payment time (active, day, date, redemption count); rejects at-cost + discount combinations
- Ledger entries record the post-discount effective amount paid; `orders.discount_amount` and `tabs.discount_amount` store the saving for reporting
- Audit trail: every applied discount is recorded in `applied_discounts` with a name snapshot (survives discount edits/deletions) and the `redemptions` counter is incremented atomically
- `GET/POST/PATCH/DELETE /api/discounts` endpoints; discount CRUD in Admin; product multi-select for qualifying items

#### Inventory adjustment breakdown card in reports
- New `GET /api/reports/inventory-adjustments?from=&to=&tz=` endpoint — returns per-product breakdown: `adjustment_count`, `total_delta` (net units), `total_cost_impact` (sum of ledger amounts at cost price at time of adjustment); sorted by absolute cost impact descending
- **By Item tab**: when the selected period has any adjustments, an **Inventory Adjustments** card appears above the sales list showing each affected product (name, count, net units, cost impact in green/red) and a total impact row
- `InventoryAdjustmentItem` type added to frontend API client
- BDD: new scenario "Inventory adjustment report shows per-product breakdown"

#### Inventory adjustment account and report visibility
- Inventory adjustments now post ledger entries to a dedicated **`inventory_adjustment`** account (`Inventory Adjustment`) instead of `NULL`; the account is seeded on startup and visible in Ledger → Balances
- Entry description improved: `Inventory adjustment: {name} (+3 units)` / `(-1 units)` for readability
- Amount = `delta × product.cost`; surplus (positive delta) is a positive amount; shortage is negative
- **Reports — By Item tab**: an `Inv. Adjustment` stat tile appears when the period has non-zero adjustments (green for surplus, red for loss)
- **Reports — Range tab**: each day row shows `adj ±$X.XX` sub-line when that day has adjustments
- `GET /api/reports/daily-total` now always returns `inventory_adjustment_total`; `GET /api/reports/daily-range` now includes `adjustment` per day entry
- BDD: 3 new inventory adjustment scenarios (account, loss amount, gain amount); 1 new reports scenario (`inventory_adjustment_total` field present)

#### Restock and inventory adjustment hide inactive and supply-based products
- **Restock view**: inactive products no longer appear in the Products section; the existing supply-based filter now also excludes inactive products (`active !== false && !uses_supplies`)
- **Inventory adjustment view**: supply-based products are now excluded on the frontend (previously only rejected by the backend); inactive products are also hidden — both filters applied at load time and after each adjustment refresh
- No backend changes required — the backend already rejects supply-based products with a clear error; the frontend now prevents users from even attempting ineligible adjustments

#### By Item report merged with Daily summary
- The separate **Daily** tab has been removed; the daily summary (Orders, Sales, Cash, Card, Cost, Profit) now appears at the top of the **By Item** tab
- Both the item breakdown and the summary stats share the same From / To date pickers and re-fetch together automatically when either date changes
- `GET /api/reports/daily-total` now accepts `from` / `to` date range parameters (keeps `date` for backward compatibility); totals now include **tab payments** in addition to orders for `order_count`, `total_sales`, `cash_sales`, `card_sales`, and `total_cost`
- Frontend calls `sales-by-item` and `daily-total` in parallel on the By Item tab
- BDD: frontend scenarios updated (Daily tab scenarios replaced by By Item variants); new backend scenario "Daily total accepts from/to date range and includes tab payments"

#### Timezone-aware daily reports
- All date-filtered report endpoints (`sales-by-item`, `daily-total`, `daily-range`) now accept a `tz` query parameter (IANA timezone name, e.g. `America/Monterrey`)
- Backend uses PostgreSQL `AT TIME ZONE` to convert `paid_at` timestamps before extracting the calendar date — orders are no longer misattributed to the wrong day when the server runs in UTC
- Default timezone: `America/Monterrey`; prior behaviour (UTC cast) is preserved when `tz=UTC` is passed
- Frontend detects the browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and passes it with every report request
- `today()` helper in ReportsView now uses `toLocaleDateString('en-CA', { timeZone })` so the default date is always the local calendar date, not UTC midnight
- `daily-range` loop seeds dates at `T12:00:00` to avoid DST boundary edge cases when iterating with `setDate()`
- BDD: existing test steps updated to pass `tz=UTC` for deterministic results; new scenario "Sales by item report respects explicit timezone parameter"

#### Discount applied shown in ledger entries
- When an order or tab payment had a discount applied, the ledger entry now surfaces the discount name and amount saved
- `GET /api/ledger` now LEFT JOINs `applied_discounts` and returns `discount_name` and `discount_amount` on each entry (null when no discount)
- In the Entries tab: a `🏷 Name −$X.XX` line (amber) appears below the description on any entry where a discount was used
- When expanding an entry, the same discount appears as a footer row in the items table, separated by a divider line
- BDD: new backend scenario "Ledger entry includes discount info when a discount was applied" verifying `discount_name` and `discount_amount` fields on the sale entry

### Fixed

#### Mobile layout — ProductsView controls and ProductPicker filter bar
- **ProductsView**: Separated the `+ Add Product` button onto its own full-width row; the search input and grid/list toggle now share the row below it, with `flex-wrap: wrap` so the toggle drops below the search on very narrow screens instead of scrolling off-screen
- **ProductPicker**: Split the header into two rows — title + view toggle on row 1, filter buttons (● Active, ◈ In Stock, ↑ Most Sold) on row 2 with `flex-wrap: wrap`; any combination of filters now stacks cleanly on small viewports with no horizontal scroll
- Added `min-width: 0` to `list-item__main` and list-item rows in ProductsView to prevent long product names or inline price-edit controls from pushing content beyond the viewport width

---

## [1.0.0-beta.2] — 2026-04-13

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

#### Register moved into Admin
- The **Register** section (open register, cash out, close register) is now part of the **Admin** page — it no longer has its own nav item or route
- The nav bar item "Register" has been removed; the app now lands on **Checkout** by default
- `/register` redirects to `/admin` so any existing bookmarks keep working
- All register `data-testid` attributes are unchanged — BDD scenarios continue to pass by navigating to `/admin`

#### Authorized users management in Admin (admin-only)
- Admin users can add, remove, and change the role of authorized users directly from the Admin page
- Roles: **Staff** (default) and **Admin**; role changes take effect on the user's next sign-in
- The section is only visible to users with `role: admin`; staff see only the PIN and Register sections

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
