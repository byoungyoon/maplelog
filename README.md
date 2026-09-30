# Maplelog

A MapleStory ledger that reads boss schedulers through the Nexon Open API. Sign in with a verified Nexon API key; each Nexon account gets a separate ledger. There is no demo mode.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000 and enter your API key. The app starts loading boss states for all account characters. Search for a character on the Bosses page to inspect its details.

Run the background worker in a separate terminal:

```sh
npm run worker
```

The normal polling interval is 60 minutes. Focus tracking polls the selected character every two minutes for up to two hours. The worker continues independently of browser activity. Manual requests and the worker share Firestore leases and a per-key request budget: up to 800 calls per rolling 24 hours and five per second.

## Completion and income

- The dashboard aggregates all characters. Character searches do not change its scope.
- Boss income uses completed boss crystals and selected drops at a fixed one-person share. Remaining boss estimates are shown separately.
- There is no paid/unpaid distinction, payment entry form, or settlement action. Existing payment records are retained for backup compatibility and do not affect current income.
- Boss cards group completed characters by boss. The compact header places the boss name, completed character count, and income side by side.
- Select up to five prominent drop candidates directly from a character's expanded row. Select only items actually acquired; Nexon does not report acquired drops or sales.
- The Records page lists crystals and drops. CSV exports use completion-based income.

## Prices and sources

Boss images, reward candidates, and crystal values come from public MapleScouter data. Source URLs and verification dates are recorded in `src/data/scouter-catalog.json`.

The item price book is refreshed from the official Vera web auction by `npm run auction:refresh`. Its read-only collector uses quick search for every ledger item, prepending one space to names containing `(`, checks exact names and current-world listings, then records the lowest displayed unit price for a plain listing on the first result page. Missing or ambiguous quotes stay unpriced and are hidden from the Prices page while remaining in the ledger for future searches and historical records. The collector saves dated observations in Firestore as well as local JSON files. The Prices page shows the latest collection and the target 10:00 Asia/Seoul daily refresh time; the Dots schedule is not yet active. Existing drop price snapshots change only through explicit repricing in the drop details. See [the collection procedure](kb/auction-daily.md).

## Deployment and secrets

The existing owner's ledger and encrypted key remain in the migrated Firestore root collections. New Nexon accounts use separate `accounts/{accountSignature}` subcollections for their ledger, encrypted key, request ids, API usage, leases, and analysis cache. The server uses the Firebase Admin SDK; `firestore.rules` denies direct client access. Set `FIREBASE_PROJECT_ID=maplelog-3ba66` and put the service-account JSON at `.local-secrets/firebase-service-account.json` for local work. The file is Git-ignored. For Vercel, set `FIREBASE_SERVICE_ACCOUNT_JSON` as a server-only environment variable instead. The headed Chrome auction collector still uses the original owner's local profile; the local worker polls connected accounts. See the [Vercel deployment guide](docs/deployment-vercel.md).

The Nexon credential encryption key is stored separately in `.local-secrets/credential.key`. For public deployments, configure `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_JSON` as described in `.env.example`. Set `APP_ORIGIN` to pin the production origin if desired. Login verifies the entered API key with Nexon; a new account gets a new Firestore ledger automatically. Never expose credentials through `NEXT_PUBLIC` variables.

Back up Firestore and the encryption key separately. JSON exports contain no Nexon API key. Restores require a preview and explicit confirmation. Disconnecting removes the credential and preserves the ledger.

## Verification

```sh
npm run typecheck
npm run lint
npm run test
npm run e2e
npm run build
```

Tests use the local Firestore emulator with the separate `demo-maplelog` project; they require Firebase CLI and Java 21. E2E tests use port 3100. Screenshots and traces are disabled at the user's request.

See the [work log](kb/work-log.md), [verification report](docs/verification.md), and [API contract](docs/api-contract.md). Project Markdown documentation is written in English; the application UI is Korean.
