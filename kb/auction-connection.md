# Web Auction Connection

## Verified on 2026-09-30

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

- Inspect the actual item search interface after resolving the enrollment gate.
- Verify market scope, item identity, upgrade conditions, and per-unit prices.
- Add a validated auction price source that preserves manual overrides and
  existing drop snapshots, without letting reference-price refreshes overwrite it.
- Test a real read-only collection and ledger update before enabling recurrence.
- Configure a weekly dots task once browser access and a supported path back to
  Maplelog are available. No dots schedule has been created from this session.

Dots supports a browser and recurring responsibilities according to its
[official getting-started guide](https://learn.chatgpt.com/docs/dots/getting-started).
Those capabilities do not establish that this auction's authenticated workflow
works unattended; that remains unverified.

## Post-enrollment retry

After the owner enabled OTP, a subsequent headed Chrome attempt passed the enrollment gate. The character-selection page then displayed a temporary-unavailability message. No item searches or prices were collected, and no recurring schedule was created. This supersedes the initial enrollment blocker above.
