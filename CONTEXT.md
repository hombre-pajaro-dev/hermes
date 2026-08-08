# Hermes Mercury POS — Domain Context

## Glossary

### Checkout Layout
The responsive two-panel UI for the Checkout view. On tablet (≥1024px wide) it renders a fixed 60/40 split: product picker on the left (60%), cart panel on the right (40%). On phone (<1024px) it renders the product picker full-screen with a sticky cart bar at the bottom.

### Cart Panel
The surface that displays cart items, discount info, totals, and payment controls. On tablet it is always visible in the right column. On phone it is the full-screen overlay that expands from the sticky cart bar.

### Sticky Cart Bar
Phone-only strip pinned to the bottom of the screen showing item count and running total. Hidden when cart is empty; slides in on first item add. Tapping it expands the Cart Panel to full screen. Collapsing returns to the product picker.

### Inline Cash Expand
The cash payment UX used in both Checkout and Tabs. When the cashier taps "Pay with Cash", a cash input section expands inline below the payment buttons — no page navigation. Shows amount-received field and live change-due calculation. Collapsing the section (or tapping Back) returns to normal cart state.

### Payment-in-Progress State
When the Inline Cash Expand is open on tablet, the left product panel is dimmed and pointer-events are disabled. Prevents accidental item additions during cash handoff. Collapsing the cash section restores full interactivity.

### Tabs Cash Fix
The Tabs view receives only the Inline Cash Expand treatment. The existing list + detail layout is preserved; no responsive split-panel redesign applies.

### Payment Method
One of three values stored on orders and tabs: `cash`, `card`, or `transfer`. Determines which ledger account receives the sale revenue and whether a card commission is applied.

### Transfer (payment method)
A customer pays via bank transfer. Revenue posts to the Digital Account. No commission is applied. UI: one-tap button (no amount-received input). Available to both staff and admin in Checkout and Tabs.

### Digital Account
The ledger account (`account = 'digital'`) that holds revenue from card and transfer payments — both land in the same physical bank account. Net of card commissions. Previously named `credit_card`.

### Card Commission
A fee automatically deducted when `payment_method = 'card'`. Computed as `total × rate × (1 + IVA rate)` and recorded as two ledger entries: one against the Digital Account (`commission_transfer`) and one against the `commissions` account. Not applied to transfer payments.

### Staff Price
The price charged to staff on at-cost tabs. Stored as `staff_price` (flat dollar amount) per product. Seeded to `cost` on migration (0% markup). Managed inline in ProductsView, admin-only. Displayed with a read-only markup label: `(staff_price - cost) / cost × 100`.

### At-Cost Tab
A tab opened with `at_cost = true`. Items are priced at `staff_price` instead of `price`. Label shown in UI: `(staff)`. Discounts are disabled on at-cost tabs.

### Physical Count
The act of entering actual shelf counts at session close, collected as part of the Close Reconciliation step. Only products that were active during the session (sold, tabbed, or restocked) and that are unit-tracked without supply dependencies are shown for counting. Discrepancies create Inventory Adjustments visible in the session report and P&L. Counts are updatable — re-submitting replaces the previous entry.

### Close Reconciliation
The single step at session close where the admin records three actuals: `closing_cash` (physical cash in drawer), `actual_digital` (bank/app balance for card + transfer payments), and per-product Physical Counts. All three are submitted together when closing the register. The backend closes the session and creates Inventory Adjustments atomically in one request. The session report then shows the Reconciliation Narrative derived from these inputs. See [[close-reconciliation-draft]] for how in-progress entries survive having to leave the form mid-count.

### Close Reconciliation Draft
The in-progress, not-yet-submitted state of the Close Reconciliation form, persisted to `localStorage` keyed by the open session's id so it survives navigating away — most commonly to Tabs, since the register won't close while tabs are open, forcing the admin off the close form to pay them. Discarded on successful close, or silently ignored (and overwritten) if the stored session id no longer matches the currently open session.

Physical Counts restore silently — paying off a tab doesn't change what's on the shelf, so a stale count is still an accurate count. `closing_cash` and `actual_digital` restore too, but flagged for re-verification: paying a tab in cash or digitally changes the drawer/balance the admin already counted, and Close Reconciliation exists specifically to catch that kind of discrepancy, so silently resubmitting a now-stale money count would defeat the point. The flag on a field clears the moment the admin edits that field — editing is the signal they looked at it. The Close button is never blocked by an unresolved flag; it's a nudge, not a gate.

### Reconciliation Narrative
The interpretive analysis displayed in the session report after Close Reconciliation is submitted. Compares expected vs actual across cash, digital, and inventory, and classifies the session into one of these diagnoses:

| Cash | Digital | Inventory | Diagnosis |
|------|---------|-----------|-----------|
| Over | balanced | Short | Likely unrecorded cash sale |
| balanced | Over | Short | Likely unrecorded digital sale |
| Short | balanced | balanced | Cash theft or miscounting |
| Over | balanced | balanced | Overcharge or double payment |
| balanced | balanced | Short | Spoilage / shrinkage — no missing money |
| Short | balanced | Short | Items taken without payment |
| — | — | — | Mixed signals — manual review |

Overall status is **OK** when `net_variance >= 0` (you collected at least what was expected). Inventory shortages alone do not mark a session as problematic if money reconciles.

### Net Variance
`cash_variance + digital_variance`. Positive = more money collected than expected; negative = less. The primary signal used by the Reconciliation Narrative to determine if a session is financially OK.

### Unrecorded Sale
A sale that was served and collected but never entered into the POS. Inferred — never directly observable — when cash or digital is over AND inventory is short by a corresponding amount. The system flags this as a diagnosis in the Reconciliation Narrative; it does not auto-create an order.

### Session Payment
A payment run (payroll, expense, or savings transfer) linked to a register session. Appears in the session report and in the P&L. If no session is specified when running payments, the system automatically links the entry to the currently open session. The session selector in the Distribute Payments UI allows overriding this — useful for retroactively linking a payment to a specific closed session.

### Session (Register Session)
A variable-length trading period. A session may span hours, days, or a full week depending on business volume. It begins when the register is opened and ends when all open tabs are settled and the register is closed. A session is the unit of cash reconciliation: all sales and tab payments within a session are reconciled against the opening and closing cash counts.

### Tab (Session-Scoped)
A tab is exclusively owned by the session it was opened in. It can only be paid while that session is open. All tab payments belong to the session for reconciliation purposes (`session_id`, not `paid_at`). A session cannot be closed while it has open tabs.

### Tab Write-Off
The admin-only act of voiding a tab that has items on it — used when a customer cannot or will not pay. Records a write-off ledger entry so the lost amount is visible in the session report. Intended as a last resort; standard tab closure is payment by the customer.

### Markup %
Displayed on each product in ProductsView, admin-only. Computed as `(price - cost) / cost × 100`. Answers "how much above cost is the selling price?" Distinct from the staff price markup, which is `(staff_price - cost) / cost × 100`.

### Restock
The act of purchasing new units of unit-tracked products and/or Supplies from a Provider, recorded as one `restock_orders` row via `POST /api/restock`: one provider, one payment account, one combined ledger expense, even when the purchase mixes product line items and supply line items. Restocking a product updates its `cost` going forward (from real $ paid ÷ quantity) — see [[supply-cost]]. Untracked products (`track_inventory = false`) cannot be restocked this way — see [[session-bill]].

### Supply Cost
A Supply's own per-unit `cost`, set either by [[restock]] (quantity + total paid → derived unit cost, updates `cost` going forward) or by direct admin edit in the Supplies screen — the latter exists so an accurate starting cost can be set at rollout without needing to change quantity on hand. Distinct from [[recipe-cost]], which is derived from it.

### Recipe Cost
For a supply-based product (`uses_supplies = true`, i.e. it has `product_supplies` rows), `cost` is not stored or manually editable — it is computed as `sum(quantity_per_unit × supply.cost)` across its ingredients, evaluated wherever product cost is read (listings, checkout/tab sale-time snapshot, Markup %). Because it's derived from real [[supply-cost]] rather than guessed, it needs no retroactive correction — contrast with [[session-bill]] reconciliation, which exists precisely because untracked-product cost *is* a guess. See ADR 0004.

### Session Bill / Provider Payment
The mechanism for untracked products (`track_inventory = false`): `cost` is a manually-set estimate snapshotted onto `order_items.unit_cost` at sale time, same as any product. Because untracked products are sold first and settled with the Provider periodically (not pre-purchased like Restock), the real cost isn't known until later. `GET /providers/session-bill` totals what's owed per provider for units sold in a date range; `POST /providers/:id/payment` records the real payment. The session report then retroactively replaces the estimated COGS for that provider's products with the real amount paid, split proportionally across products by their share of estimated cost. This reconciliation is applied consistently everywhere the session report reports cost (`total_cost`, `gross_profit`, and `pnl.cogs`/`pnl.gross_profit` all agree) — see ADR 0004.
