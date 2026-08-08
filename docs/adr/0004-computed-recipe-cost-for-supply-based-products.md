# ADR 0004 — Computed Recipe Cost for Supply-Based Products

## Status

Accepted

## Context

`products.cost` is a single number used two ways: (1) it is snapshotted onto `order_items.unit_cost` / `tab_items.unit_cost` at sale time to compute COGS in every sales/session report, and (2) it drives Markup %. For unit-tracked products (no supply ingredients), this number is kept honest by Restock (`POST /api/restock`): every restock records what was actually paid and updates `products.cost` going forward, so COGS reflects real purchase price.

For supply-based products (`uses_supplies = true`, priced via `product_supplies.quantity_per_unit` against the `supplies` table), `cost` was instead a flat number typed by hand in ProductsView. Restocking a supply (`POST /supplies/:id/restock`) only incremented `supplies.quantity` — it recorded no price and never touched any product's `cost`. So the accrued COGS for a latte was whatever an admin guessed once, permanently disconnected from what was actually paid for milk, beans, or cups.

This is the same shape of problem already solved once for untracked products (`track_inventory = false`): `products.cost` there is also a guess, and paying a provider (`POST /providers/:id/payment`) retroactively replaces the guessed COGS with the real amount, proportionally split across that provider's products (see the "Option A" reconciliation in `sessions/:id/report`, commit `8f8cc51`). Applying that same retroactive-replacement pattern to supplies does not work cleanly, though: a provider payment covers a whole untracked product's cost 1:1, but a single supply (milk) is usually only one ingredient among several in a recipe — replacing 100% of a product's estimated COGS with the price of one ingredient would zero out the cost of every other ingredient in the same recipe.

Untracked products and supplies also differ in when money changes hands relative to consumption: untracked products are sold first and settled with the provider periodically (consignment-style), so reconciling after the fact is the only option. Supplies are bought before they're used, exactly like tracked products — so the forward cost-basis approach already used for tracked-product restocking is the natural fit, not retroactive patching.

## Decision

Give `supplies` its own `cost` column. It can be set two ways, both writing the same field:
- **Restock** (`POST /api/restock`, extended to accept supply line items alongside product line items in one combined purchase — one provider, one payment account, one ledger expense): quantity + total paid → derived unit cost → updates `supplies.cost` going forward, mirroring how tracked-product restock already updates `products.cost`.
- **Direct admin edit** in the Supplies admin screen, so an accurate starting cost can be set immediately at rollout without needing quantity on hand to change (mirrors the existing `PATCH /products/:id/cost` path for non-supply products).

For any product with `uses_supplies = true`, `cost` becomes **computed**, not stored: `sum(quantity_per_unit × supply.cost)` across its `product_supplies` rows, evaluated wherever `products.cost` is currently read (product listing, checkout/tabs sale-time snapshot, Markup % display). Manual cost entry is removed for these products — the cost field becomes read-only, always equal to the ingredient sum. `price` and `staff_price` remain manual; margin/labor/waste buffers are the admin's job to bake into price, not cost.

Because cost is now real by construction at the moment of sale, no retroactive COGS-replacement step is needed for supplies — the existing per-sale `unit_cost` snapshot is already accurate. The same fix pass also corrects an inconsistency found in the existing untracked-product reconciliation: `GET /sessions/:id/report` computed `pnl.cogs` from the reconciled (real-payment) figures but left the top-level `total_cost` / `gross_profit` fields on the estimated figures — same response, two disagreeing cost numbers. Both now read from the same reconciled `byItem` totals.

## Alternatives considered

- **Retroactive reconciliation for supplies, mirroring the provider/untracked pattern exactly**: rejected — a supply payment doesn't correspond 1:1 to a product's full recipe cost the way a provider payment corresponds 1:1 to an untracked product's full cost. Replacing 100% of a multi-ingredient product's COGS with one ingredient's price is wrong whenever a product uses more than one supply (the common case).
- **Keep `products.cost` manually editable for supply-based products, with the computed ingredient sum as a pre-filled suggestion**: rejected — an editable field can silently drift from the ingredient sum again, reopening the exact phantom-cost gap this decision exists to close.
- **Leave existing supplies at cost = 0 until restocked, no direct-edit path**: rejected — every supply-based product would show 0 cost / 100% margin in reports from the moment this ships until every ingredient happens to get restocked, which could be days or weeks for slow-moving ingredients.

## Consequences

- New column: `supplies.cost` (`DOUBLE PRECISION NOT NULL DEFAULT 0`). Existing supplies start at 0 until restocked or manually edited.
- `products.cost` is no longer authoritative for supply-based products; it must be computed at every read site (products list query, checkout/tabs `unit_cost` capture, Markup % calc). `PATCH /products/:id/cost` must reject or no-op for `uses_supplies = true` products.
- `POST /api/restock` accepts a mixed item list (products and/or supplies) under one provider/payment/ledger entry instead of two separate calls (`api.restock` + looped `api.restockSupply`); `POST /supplies/:id/restock` (quantity-only, no cost) is superseded by this path for costed restocks.
- `restock_items`-equivalent storage needs a supply-item counterpart so the Ledger drill-down (`GET /ledger/entries/:id/items`) and the session report's restocked-items list can show supply lines alongside product lines.
- Session report gains a `supplies_restocked` list, parallel to the existing `restocked` (products) list.
- `total_cost` / `gross_profit` in `GET /sessions/:id/report` now match `pnl.cogs` / `pnl.gross_profit` — both reconciled — closing the inconsistency identified above.
- If a supply's cost later changes (a later restock at a different price), it only affects future computed product cost and future sales; already-recorded `order_items.unit_cost` snapshots are untouched, consistent with how tracked-product cost changes already behave.
