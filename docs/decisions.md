# Implementation Decisions

- Use Next App Router, Tailwind CSS, Zustand, and the user's requested feature folder pattern. Use TanStack Query for server data.
- Require a verified personal Nexon API key before ledger access. Remove demo routes and production demo data; retain isolated test fixtures.
- Store the ledger and operational state in Firestore. Use server-side transactions, revisions, and request IDs to reject conflicting or duplicate mutations. Represent money as integer strings and calculate with BigInt. The former SQLite store was migrated and removed on 2026-09-30.
- Integrate the real character list, character image, and boss scheduler endpoints. Do not invent kill timestamps, acquired drops, or sales.
- Use public MapleScouter snapshots for boss images, reward candidates, and crystal prices. Use exact-name Vera auction observations for the item price book; clear missing or visibly optioned quotes, and retain existing drop price snapshots.
- Follow the supplied sage glass references: floating navigation, transparent outer workspace, internal scrolling, Pretendard, and a distant nature video background.
- Respect reduced motion, inactive tabs, and the background motion toggle. Do not capture new screenshots.
- Aggregate all account characters on the dashboard. The Bosses page searches characters and shows their boss states without changing dashboard scope.
- Group completed records into boss cards. Keep the boss identity, completed character count, and completed income in a single compact header row.
- As requested on 2026-09-30, use only completion and acquired drops for income. Remove paid/unpaid UI, cash-date reporting, and payment commands from the HTTP API. Keep old payment records solely for backup compatibility.
- Write project Markdown files in English and maintain significant work history under `kb`.
