# Web Auction Connection

## Five-item usage trial on 2026-09-30

The saved browser profile returned to Nexon sign-in. Authorized reauthentication
succeeded after reconnecting the interactive process and accommodating the login
button's recent-login label. Character selection and five filter searches then
completed successfully without an observed OTP challenge.

Three searches returned listings; two returned zero results. The search counter
increased from 1/100 to 6/100. See [the trial record](auction-usage-trial.md) for
prices, counts, scope, and usage limitations. At the time, the two zero-result
items were hidden from the Prices page through `src/data/auction-listings.json`.
That display rule was replaced with a collected-price check: currently unpriced
items are hidden from the Prices page. The ledger entries and drop history are
preserved for future searches. The browser was closed afterward.
No credentials were added to repository files, no prices were imported, and no
dots schedule was created.

## Latest successful retry on 2026-09-30

Authenticated with the newly supplied email-form account in the dedicated headed Chrome profile. Character selection loaded successfully, and an eligible Vera character entered `/buy`. No OTP challenge was required during this observed login and search flow.

One read-only filter search for Dreamy Belt returned 1,489 listings sorted by ascending unit price. The first displayed listing was 3,839,999,999 meso. The displayed search counter changed from 0/100 to 1/100; the sale counter remained 0/20. This is an observation under the current UI filters, not a validated world/option-specific reference price. No purchase, sale, ledger price import, or recurring job was performed. The dedicated browser was closed after verification, retaining its Git-ignored session profile.

The email and password were supplied only to the official login form through a private interactive process. They were not added to repository files or command-line arguments.

## Initial attempts on 2026-09-30

A headed Chrome session successfully reached Nexon sign-in through
`https://auction.maplestory.nexon.com/character-select` and authenticated with
the account authorized by the owner. The auction then refused entry because
the account was not enrolled in Nexon OTP. Item search was not accessible.
No auction prices were collected or written to the ledger.

The [official auction guide](https://maplestory.nexon.com/Guide/N23GameInformation/Articles/394)
distinguishes OTP account enrollment from an OTP challenge for purchases and
sales. Search is limited to 100 requests per day. The observed enrollment gate
must be resolved by the owner before testing search automation.

## Resume the connection

1. Close any existing dedicated auction Chrome window.
2. Run `npm run auction:connect` from the project directory.
3. Complete Nexon sign-in and, if requested, OTP enrollment in the browser.
4. Select the intended character and verify item search is available.

The command only opens the browser and reports connection stages. It does not
collect prices, schedule work, or perform transactions. It uses the separate
Chrome profile at `.local-secrets/auction-browser`, which Git ignores. The
profile contains authentication state and should be treated as private. Never
commit, export, or include it in a ledger backup. Passwords are not accepted as
command-line arguments or saved by the script. No screenshots, traces, raw page
contents, or authentication tokens are logged.

The existing Maplelog API-key disconnect control does not clear this separate
browser session. Sign out of Nexon in the dedicated browser to end that session.

## Remaining work

- The bounded collector, Vera scope, and first ledger update are documented in
  [Daily auction price refresh](auction-daily.md). Full item option identity
  remains unverified; visibly optioned first listings are left unpriced.
- Connect the owner's computer to Dots and create the requested daily 10:00
  Asia/Seoul responsibility. No Dots schedule has been created from this
  Codex session.

Dots supports a browser and recurring responsibilities according to its
[official getting-started guide](https://learn.chatgpt.com/docs/dots/getting-started).
Those capabilities do not establish that this auction's authenticated workflow
works unattended; that remains unverified.

## Post-enrollment retry

After the owner enabled OTP, a subsequent headed Chrome attempt passed the enrollment gate. The character-selection page then displayed a temporary-unavailability message. No item searches or prices were collected, and no recurring schedule was created. This supersedes the initial enrollment blocker above.
