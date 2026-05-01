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
