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
