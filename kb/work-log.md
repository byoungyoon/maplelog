# Work Log

## 2026-09-30 — Hide Unpriced Items and Verify Parenthesis Listings

- Hid all 40 currently unpriced items from the Prices page. The 67 ledger entries, auction observations, drop history, and future full-search scope remain intact. The empty state now explains that only confirmed-price items are shown.
- Inspected three Vera auction quick-search result pages whose card names contain an extra space before `(`. Matched that display spelling to the corresponding ledger names, checked that the cheapest first cards had no visible option markers, and recorded unit asking prices of 7,400,000,000, 6,439,999,998, and 32,999,999,979 meso for the belt, face accessory, and eye accessory Exceptional Hammers.
- Stored the corrected five-item report in Firestore, applied the three verified prices, and advanced the live ledger to revision 1648. The two other Exceptional Hammers had zero results. The auction search counter reached 97/100. The ledger now has 27 priced and 40 unpriced items. Future full collection still searches all 67 items.
- Verified the live Firestore ledger and report counts, TypeScript, ESLint, whitespace, and 85 unit tests, including auction display-name normalization and unpriced-item filtering.

## 2026-09-30 — Firestore Migration and Auction Report Storage

- Created the `maplelog-3ba66` Firestore Standard database in Seoul and configured server-only Firebase Admin access. Client rules deny direct reads and writes.
- Migrated the live revision 1646 ledger, encrypted Nexon credential, connection generation, request ids, API usage, leases, analysis cache, and both auction reports. All 37 Firestore documents were read back and compared with the source, including an exact ledger hash. The ledger contains 67 item prices (24 quoted), 60 characters, 48 completions, and three drops.
- Replaced runtime SQLite access with Firestore transactions and converted API routes, background synchronization, authentication limits, boss analysis, auction collection, and price application. Dated auction reports are now written to Firestore as well as local JSON. Quick searches for names containing `(` submit one leading space while matching the exact original item name.
- Compressed the aggregate Firestore ledger from about 212 KB of JSON to about 63 KB of stored Base64 gzip data without changing revision or contents, leaving room for future records under Firestore's document-size limit. Deployed rules that deny direct client access.
- Updated unit and browser tests to use the isolated `demo-maplelog` Firestore emulator. Verification: 84 unit tests, eight browser tests, TypeScript, ESLint, and the Webpack production build passed. Removed SQLite after the verified migration.

## 2026-09-30 — Vera Auction Price Collection and Read-Only Price Book

- The initial filter-search pass classified 67 ledger names, but its autocomplete was restricted to armor categories. The 44 names it marked absent were not valid general-auction observations. Ten observed prices were imported and retained until the next full quick-search refresh; 57 entries were unpriced.
- Corrected the collector to submit each item name through quick search. At the owner's request, queried only those 57 unpriced entries on this run. Fourteen gained a price, 37 returned zero results, two first pages contained only visibly optioned exact-name listings, and four first pages contained no exact-name listing. The auction counter moved from 32/100 to 89/100. The live ledger now has 24 priced and 43 unpriced auction items; revision advanced from 1645 to 1646. Future `auction:refresh` runs search all 67 entries.
- The 57-entry update created a SQLite backup. Drops, settlements, bosses, characters, and settings matched the backup afterward. The earlier two-item hiding rule was removed; the page now uses the general collected-price rule recorded above.
- Added a resumable headed-Chrome collector, validated ledger application, auction provenance, and a read-only item price section. Removed the item's manual price editor and JSON import from the Prices page; live item price commands reject manual updates. The page shows the target 10:00 Asia/Seoul refresh time and latest observation.
- Recorded the procedure and Dots setup in [Daily auction price refresh](auction-daily.md). A Dots schedule remains uncreated because this session has no Dots scheduling connection. Verification: 84 unit tests, TypeScript, ESLint, and whitespace checks passed.

## 2026-09-30 — Five-Item Auction Trial and Price List Filtering

- Completed five agent-directed searches in headed Chrome after reauthentication. Three items returned listings and two returned zero results; the auction search counter increased from 1/100 to 6/100.
- Recorded observed listing counts and prices in `src/data/auction-listings.json`. These prices are observations only and have not been imported into the ledger.
- Hid Ruby Boss Ring Box and Sol Erda Energy from the Prices page based on confirmed zero-result searches. Unchecked items remain visible; all ledger items, boss drops, and historical records remain intact.
- Updated the empty state to reflect filtered search results. Future verified listing observations can restore visibility by updating the snapshot.
- Documented connection recovery, search scope, and usage-measurement limitations in [Auction browser usage trial](auction-usage-trial.md). This session did not invoke dots or configure a schedule.
- Verification: TypeScript, targeted ESLint, and whitespace checks passed. A read-only check against the live ledger confirmed 67 retained items, 65 visible price entries, both zero-result names excluded even during search, and Dreamy Belt still searchable.


## 2026-09-30 — Auction Search Verified and Settlement Layout Aligned

- Successfully retried official auction sign-in, character selection, and one item search in headed Chrome. The observed flow did not require an OTP challenge.
- Confirmed ascending unit-price results for Dreamy Belt. No transactions, ledger price writes, or recurring jobs were performed; see [Web auction connection](auction-connection.md).
- Removed the revenue summary's Records shortcut icon.
- Removed the narrower settlement-page width cap and matched the Bosses grid's responsive 300-pixel minimum columns, 12-pixel gaps, 16-pixel card padding, and pale glass surfaces.
- Updated text, dividers, and expanded drop controls for the lighter cards while retaining the existing completion and drop workflows.
- Verification: eight browser tests passed at desktop and mobile widths, plus TypeScript, ESLint, and the Webpack production build. Screenshots were not taken.


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
