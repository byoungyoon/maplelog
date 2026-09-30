# Maplelog

A personal MapleStory ledger that reads your boss scheduler through the Nexon Open API. Track boss completion and acquired drops with your own verified API key. There is no demo mode.

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

The normal polling interval is 60 minutes. Focus tracking polls the selected character every two minutes for up to two hours. The worker continues independently of browser activity. Manual requests and the worker share SQLite leases and a per-key request budget: up to 800 calls per rolling 24 hours and five per second.

## Completion and income

- The dashboard aggregates all characters. Character searches do not change its scope.
- Boss income uses completed boss crystals and selected drops at a fixed one-person share. Remaining boss estimates are shown separately.
- There is no paid/unpaid distinction, payment entry form, or settlement action. Existing payment records are retained for backup compatibility and do not affect current income.
- Boss cards group completed characters by boss. The compact header places the boss name, completed character count, and income side by side.
- Select up to five prominent drop candidates directly from a character's expanded row. Select only items actually acquired; Nexon does not report acquired drops or sales.
- The Records page lists crystals and drops. CSV exports use completion-based income.

## Prices and sources

Boss images, reward candidates, and crystal values come from public MapleScouter data. Source URLs and verification dates are recorded in `src/data/scouter-catalog.json`.

The item price provider matches exact item names against MapleScouter's reference prices. These are not live, world-specific auction prices. The worker refreshes them daily; the Prices page also offers a manual refresh. Manually entered prices take precedence. Existing drop price snapshots change only through explicit repricing in the drop details.

## Deployment and secrets

Use one persistent Node server with a durable SQLite volume. Build with `npm run build`, run `npm run start`, and run `npm run worker` separately. Ephemeral serverless file systems are not supported.

Locally, the database is stored in `data/mesolog.sqlite`; the encryption key is stored separately in `.local-secrets/credential.key`. Both are excluded from Git. For public deployments, configure `APP_ORIGIN`, `OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, and `DATA_DIR` as described in `.env.example`. Generate an owner password hash with `npm run owner:hash`. Never expose credentials through `NEXT_PUBLIC` variables.

Back up the database and encryption key separately. JSON exports contain no Nexon API key. Restores require a preview and explicit confirmation. Disconnecting removes the credential and preserves the ledger.

## Verification

```sh
npm run typecheck
npm run lint
npm run test
npm run e2e
npm run build
```

E2E tests use port 3100 and an isolated temporary database. Screenshots and traces are disabled at the user's request.

See the [work log](kb/work-log.md), [verification report](docs/verification.md), and [API contract](docs/api-contract.md). Project Markdown documentation is written in English; the application UI is Korean.
