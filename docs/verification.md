# Verification

## Current Change: 2026-09-30

- TypeScript check: passed.
- ESLint: passed.
- Production build: passed with `NEXT_BUILD_DIR=.next-build-check npm run build -- --webpack`. Turbopack failed on an internal port-binding restriction in this environment, including after an elevated retry.
- Unit tests: 69 passed across seven files.
- Browser tests: eight passed, covering 1440, 1024, 390, and 360 pixel widths.
- Boss card headers now place boss identity, completed character count, and income on one row.
- Paid/unpaid controls and payment entry were removed. Tests verify completion-based totals remain independent of historical payments, old payment records do not block live drop toggles, and backup data remains intact.
- Browser coverage includes key gating, rejection of forged client success, character search, grouped boss cards, drop selection, account-wide totals, internal scrolling, Pretendard, video playback, export, and disconnection.

E2E tests run on port 3100 with an isolated temporary SQLite database and mocked external requests. Production user data is not reset. No screenshots or traces are captured.

## Existing Coverage

Domain tests cover integer money calculations, period boundaries, duplicate observations, conflict handling, revisions, and restore validation. Legacy payment helpers still have compatibility tests; they are no longer exposed through the application UI or HTTP command API.

Adapter tests cover concurrent credential changes, request coalescing, partial failures, empty responses, repeated completions, persistent 429 limits, and cancellation after disconnection. Catalog tests cover effective dates, manual price preservation, seasonal boss aliases, reference price conversion, and local asset availability.

Real API verification was performed separately from fixture-based browser tests. Previously verified live results included 24 completion records, crystal prices for 56 boss variants, and reference prices for 22 observed item candidates.

## Known Limits

Automatic 14-day backfill and a world-specific auction price provider are not implemented. See the [API contract](api-contract.md) and [retention notes](data-retention.md).
