# ADR 0003 — Single-Step Session Close Reconciliation

## Status
Accepted

## Context
When closing a register session, three actuals need to be recorded:
1. Physical cash in the drawer (`closing_cash`)
2. Bank/app balance for card + transfer payments (`actual_digital`)
3. Per-product shelf counts (Physical Count → Inventory Adjustments)

The original implementation collected `closing_cash` at close time and deferred `actual_digital` + physical counts to a separate post-close reconcile step (`PATCH /sessions/:id/reconcile`). In practice, the admin always performs both immediately — they count everything before closing. The split flow added a hidden second step with no prompting, so physical counts and digital reconciliation were routinely skipped.

## Decision
Merge both operations into `POST /close`. The endpoint now accepts `closing_cash`, `actual_digital`, and `physical_counts[]` in a single request. The backend closes the session and creates Inventory Adjustments atomically inside one database transaction.

The frontend pre-fetches active session products via `GET /register/close-preview` to populate the physical count inputs before the user submits. The `PATCH /sessions/:id/reconcile` endpoint is retained for re-submission (counts are updatable) and for clients that still call it directly.

The session report adds a `reconciliation_summary` field that classifies the session based on cash variance, digital variance, and inventory delta value — see the Reconciliation Narrative definition in CONTEXT.md.

## Alternatives considered
- **Keep two separate steps, improve discoverability**: a banner or redirect after close could prompt the admin to reconcile. Rejected — the extra navigation adds friction and the session report page is already complex; burying the reconcile card there means it gets skipped.
- **Frontend orchestration (two sequential API calls, one form)**: UI calls `POST /close` then immediately calls `PATCH /reconcile`. Simpler backend change but non-atomic — a network failure between the two calls leaves the session closed with no adjustments and no error shown to the user.
- **Separate reconcile page**: a dedicated page opened immediately after close. Rejected — still a second step, just a mandatory one. Merging into close is simpler.

## Consequences
- `POST /close` body now optionally accepts `actual_digital: number` and `physical_counts: { product_id, units }[]`. Clients that omit them get the same behaviour as before (no adjustments, no digital variance).
- `GET /register/close-preview` is a new endpoint returning the trackable products active in the current session and the current system counts.
- `PATCH /sessions/:id/reconcile` is kept as a correction path (re-submitting physical counts after close is still supported).
- Inventory Adjustments are now created inside the close transaction instead of a separate request, making the session report immediately consistent after close.
- The session report `reconciliation_summary` object is computed server-side so it is available to any API consumer, not just the React frontend.
