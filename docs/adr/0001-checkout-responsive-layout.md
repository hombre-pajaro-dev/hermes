# ADR 0001 — Responsive Checkout Layout

## Status
Accepted

## Context
Checkout is used on two device types: a shared tablet mounted at the counter (landscape, ≥1024px) and cashiers' own phones (portrait, <1024px). The previous design was a single-column card stack with a full-screen navigation step for cash payment — usable but disruptive on both devices.

## Decision
- **Breakpoint**: ≥1024px = tablet split layout; <1024px = phone layout.
- **Tablet**: Fixed 60/40 split. Product picker left (60%), Cart Panel right (40%). Cart Panel always visible.
- **Phone**: Product picker fills screen. Sticky Cart Bar appears at bottom when cart has items. Tapping the bar expands Cart Panel to full screen (covers products entirely).
- **Cash payment**: Inline Cash Expand — cash input appears inline below payment buttons. No page navigation step. Applies to both Checkout and Tabs.
- **Payment-in-progress (tablet)**: Left product panel dims and disables pointer-events while cash input is open. Prevents accidental item adds during handoff.

## Alternatives considered
- **Bottom sheet (~60%)** for phone cart: rejected — product peek is misleading (tapping it doesn't add items) and wastes space.
- **Tab toggle (Products / Cart)**: rejected — extra tap to reach cart; no persistent total visible while browsing products.
- **Resizable split on tablet**: rejected — unnecessary complexity; 60/40 serves the product-heavy use case well.
- **Full layout redesign for Tabs**: rejected — Tabs list+detail already works; conflating two UX problems.

## Consequences
- `CheckoutView` `step` state (`'order'` | `'cash'`) is removed. Replaced with `cashExpanded: boolean`.
- Existing BDD test IDs `cash-payment-view` and `proceed-to-cash-btn` need updating in feature files and step definitions.
- New CSS: media query at 1024px, sticky positioning for Cart Bar, overlay for Cart Panel on phone.
