# Auction Browser Usage Trial

## Scope

On 2026-09-30, the owner authorized a five-item browser trial to observe agent
usage before a recurring price refresh. This session used agent-directed
Playwright actions in headed Chrome. It did not invoke dots or an AI API, and
cannot establish the usage of a future dots run.

The persisted profile returned to sign-in. Reauthentication succeeded after
repairing the interactive browser connection and login-button matching. These
setup and recovery steps contribute to this session's usage.

## Observations

The official auction search counter increased from 1/100 to 6/100. All five
filter searches completed. Results were sorted by ascending unit price.

| Item (English label) | Listings | First displayed unit price (meso) |
| --- | ---: | ---: |
| Dreamy Belt | 1,490 | 3,830,000,000 |
| Magic Eyepatch | 2,016 | 2,811,100,000 |
| Loose Control Machine Mark | 2,435 | 1,350,000,000 |
| Ruby Boss Ring Box | 0 | No price observed |
| Sol Erda Energy | 0 | No price observed |

The selected character was in Vera, but the current-world-only checkbox state
was not verified. Default filters can include different upgrade conditions.
These are observed listing prices, not normalized reference prices or completed
sale prices. Zero results alone do not establish that an item is untradeable.

## Outcome and measurement limits

No purchases, sales, item removals, ledger price updates, screenshots, or
recurring schedules were performed. The dedicated browser was closed and its
private session profile retained. Credentials and authentication state were not
added to project files.

The agent has no billing meter for this session. The owner can inspect account
usage, but this trial does not provide a measured token or credit total. Do not
multiply the whole session's usage by 67/5: setup, login recovery, and reporting
are not per-item costs. A full update workflow remains unmeasured.
