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

### Physical Count Close
The act of entering actual shelf counts for all active products as part of the register close action — done in the same form as entering closing cash. Products default to the system's current unit count; the cashier only corrects the ones that differ. Discrepancies automatically create Inventory Adjustments. The physical count is visible in the session report alongside the system count.

### Session Payment
A payment run (payroll, expense, or savings transfer) explicitly linked to a register session via `session_id`. Appears in the session report as a list of individual entries. The session must be selected explicitly when running payments — the system does not infer it.

### Cross-Session Tab
A tab whose `session_id` (the session it was *opened* in) differs from the session in which it was *paid*. Cross-session tabs are normal — customers may run a tab across multiple days. For cash reconciliation purposes, the cash from a cross-session tab payment belongs to the session it was *paid in*, not the session it was opened in. The register-close expected-cash formula scopes tab payments by `paid_at` timestamp, not by `session_id`.

### Markup %
Displayed on each product in ProductsView, admin-only. Computed as `(price - cost) / cost × 100`. Answers "how much above cost is the selling price?" Distinct from the staff price markup, which is `(staff_price - cost) / cost × 100`.
