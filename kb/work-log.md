# Work Log

## 2026-09-30 — Collapsed Easy Clears and Routed Character Search

- Grouped comfortable solo clears into a native disclosure, collapsed by default, while retaining gauges and completion checks when expanded.
- Replaced the vertically stacked completion marker with a compact, single-line rounded badge without changing the card palette.
- Moved character search into the Bosses `@modal` parallel slot and `(.)characters` intercepting route. Soft navigation preserves the underlying boss screen; direct visits and reloads render the standalone search page.
- Stored explicit character selection in the URL so a reload keeps the chosen character. Missing selections still default to the strongest known character.
- Added native-dialog focus behavior, Escape/backdrop/close controls, history navigation, and mobile sizing. Closing an in-flight search prevents late navigation away from the current page.
- Preserved boss-screen scroll position during modal navigation and kept the Bosses navigation item active for nested search routes.
- Validation: eight browser tests passed, including disclosure toggling, back/forward/Escape dismissal, selection persistence, direct-page reloads, focus, and modal bounds at four viewport sizes. TypeScript, ESLint, and the Webpack production build passed. No screenshots were taken.


## 2026-09-30 — Boss Analysis and Simplified Boss UI

- Inspected the public Chrome client and implemented the local boss comparison formulas using live character calculation inputs. All 47 results matched independently executed source math.
- Added cached, ownership-checked boss analysis and daily Nexon combat-power retrieval; initial character selection uses verified combat power.
- Added pale glass boss cards, minimum-cut gauges with actual damage multiples, and current-character completion checks. Enlarged character sprites and removed the heavy hero background.
- Removed the Bosses heading/date controls, Records navigation entry, provider branding/links, and boss-card overflow menus. Kept completion cards compact with direct completion actions.
- Bosses uses the current week independently of report dates on other screens. Existing ledger data and routes remain intact.
- Validation: 82 unit tests and eight browser tests, TypeScript, ESLint, and a Webpack production build passed. Browser checks did not take screenshots.
- See [Boss analysis](boss-analysis.md) for calculation provenance, cache behavior, and upstream dependencies.

## 2026-09-30 — Web Auction Connection Probe

- Confirmed that the official web auction opens in headed Chrome and completed an authorized Nexon sign-in.
- Observed an OTP enrollment gate for the account before character selection or item search. Search-only access does not remove this account prerequisite.
- Added `npm run auction:connect` to reopen the dedicated, Git-ignored Chrome profile and report connection stages without logging credentials or page content.
- Documented the observed blocker and remaining work in [Web auction connection](auction-connection.md).
- No auction prices were imported, ledger data changed, transactions performed, or weekly dots schedule created. OTP enrollment requires the owner's action before further live testing.
- Verification: the live browser probe reached the enrollment gate; the reusable launcher passed Node syntax checking, ESLint, and whitespace checks. Its post-enrollment path remains unverified. The browser profile is confirmed to be ignored by Git.

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
