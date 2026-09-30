# Work Log

## 2026-09-30 — Compact Cards and Completion-Based Income

### Requested behavior

Move completed-character and income metrics into the boss card's top row to reduce card height. Remove actual-payment and unpaid states: the relevant distinction is whether a boss was completed. Record work under `kb` and write project Markdown in English.

### Changes

- Combined boss identity, completed character count, and income into a compact card header with responsive spacing.
- Removed crystal settlement buttons, paid/unpaid filters, payment forms, and cash-date reporting.
- Dashboard summaries distinguish completed boss income from estimates for bosses not yet completed.
- Simplified the Records page to crystal and drop entries; details open the drop editor.
- Added completion-based income calculation that ignores historical payment amounts. Old payment records remain available in backups.
- Allowed live drop quantities to change without being locked by historical payments. Existing consumed-quantity safeguards remain.
- Rejected obsolete payment commands at the HTTP API boundary and updated CSV export columns.
- Preserved explicit item repricing through the drop detail editor.
- Translated the README and project documentation into English, and added this knowledge base.

### Verification

Type checking, 69 unit tests, and eight browser tests passed during implementation. Browser tests cover mobile and desktop widths without taking screenshots. Production data was preserved. ESLint passed. The production build passed using Next Webpack after Turbopack encountered an environment-specific internal port-binding restriction. All project Markdown files were checked for remaining Korean prose; none was found.

## 2026-09-30 — Repository Update

Pulled `main` from `46c9653` to `c8f74fa` with a clean fast-forward. The incoming changes included all-character synchronization, character search and details, grouped boss cards, account-wide projections, simplified setup, and a slower nature video asset.

## 2026-09-29 — Initial Application and Integrations

- Built the Next App Router application with Tailwind, Zustand, TanStack Query, and the requested feature folder structure.
- Removed demo access and required a verified Nexon key before private ledger access.
- Integrated account characters, character images, boss scheduler observations, and a separate polling worker.
- Added SQLite persistence, encrypted credentials, owner authentication, revision checks, request idempotency, and isolated tests.
- Imported MapleScouter boss and reward assets, crystal values, and exact-name item reference prices.
- Implemented the green glass UI, floating navigation, internal scrolling, Pretendard, sage logo, and distant nature video background.
- Added one-person calculations, quick drop toggles, and character search.
- Pushed initial implementation commit `2adf87d`, followed by feature commit `46c9653` to `byoungyoon/maplelog` on `main`.

The initial version supported payment recording. That workflow was superseded by the completion-only request on 2026-09-30.
