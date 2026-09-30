# Boss Analysis

## Data and calculations

Inspected the public Chrome client at [MapleScouter results](https://maplescouter.com/ko/result) on 2026-09-30. The browser requests `/api/id` on `api.maplescouter.com` with a character name, `region=kms`, and preset `00000`. Its public client header is discovered from the public page's script rather than embedded in this repository. No Nexon credential is sent to this provider.

The provider calculates the character's Hexa damage and spline curves on its server. Maplelog retrieves those inputs and locally calculates the boss comparison; it does not independently reproduce the entire server-side character stat engine. The implementation covers the current 47 supported boss difficulty rows, with a separate Challenger lineup snapshot. The cutoff table version is 2026-09-22.

Local calculation includes Hermite interpolation/inversion, level and force scaling, symbol bonuses, job/elixir correction, ascent correction, special boss damage adjustments, party thresholds, and entry levels. The default is the source's 20-minute experienced-player comparison; Hard Lucid uses phase three. Legacy payloads without valid splines, character/world mismatches, and provider calculation errors are rejected rather than replaced with samples.

The solo threshold statistic is obtained by inverting the solo classification boundary. The gauge compares effective damage rate with that boundary, not raw stat division or clear probability. Its visual track ends at twice the solo threshold; text preserves larger actual multiples. Numeric stat details remain available in an expandable disclosure.

## Storage and requests

- `POST /api/characters/strength`: owned Nexon `/character/stat` requests, extracting the exact `final_stat` entry named combat power. Reuses the existing request budget and generation guards, uses a durable lease, and refreshes after 24 hours. Absent combat power remains unknown.
- Initial selection uses descending verified combat power, then level and stable ordering. With no known power, the highest-level character is provisional. Manual character selection is preserved during refresh.
- `POST /api/bosses/analyze`: validates ownership and connection, uses a per-character lease and a 30-second cooldown, and caches normalized results in SQLite for ten minutes. The daily analysis budget is 100 requests.
- Results from an old credential generation are not saved. Analysis data is derived cache, separate from ledger backup and recorded prices.
- The public bundle discovery and upstream response schema can change. Failures surface as errors; outdated cached UI results are explicitly identified when a refresh fails.

## Interface decisions

The user requested no provider branding, connection badges, or provider links in the application. Source documentation remains here. The navigation has Settlement, Bosses, and Prices; existing Records data and routes remain intact.

Bosses opens on the strongest character, without a report heading or date controls. Its completion cards use the current weekly report independent of dates selected elsewhere. Minimum-cut completion checks match the selected character, exact difficulty, and each record's current reset period; excluded and conflicting records are not checked.

The interface retains pale sage glass surfaces, uses readable text contrast and spacing, and replaces the dense numeric comparison with a gauge. Compact completion cards have direct completion buttons and no overflow menu. The character sprite uses a clipped, enlarged CSS presentation to remove the official image's transparent margins. The hero has no heavy background box.

## Verification

- Compared 47 rate/stat/status results against the inspected public client's isolated pure-math modules; all matched. The golden fixture contains normalized results and anonymized calculation inputs, not downloaded application code or credentials.
- Unit coverage includes formula boundaries, invalid inputs, ownership, cache/cooldown behavior, stale credential protection, strongest selection, and completion matching.
- Browser tests use an isolated database and mocked external responses at 1440, 1024, 390, and 360 pixels. They verify selection, gauges, completion checks, removed controls, and internal scrolling without screenshots or traces.
- A live owned-character request succeeded and returned 47 computed boss comparisons.
