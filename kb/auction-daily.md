# Daily Auction Price Refresh

## Scope and command

The item price book uses the official MapleStory web auction for Vera. The
dedicated character is `수민탁구몬함`. Collection checks **Current world items
only** and reads results sorted by ascending **unit** listing price. The
intended run time is 10:00 Asia/Seoul every day.

Run `npm run auction:refresh` from the project directory. This runs
`auction:collect` and then `auction:apply`. The collector uses the dedicated
headed Chrome profile in `.local-secrets/auction-browser` and reads
`NEXON_AUCTION_ID` and `NEXON_AUCTION_PASSWORD` from the Git-ignored `.env`.
Credentials are entered only into the official login form. No purchase or sale
action is used. An OTP, security check, expired login, or site change may
require owner attention.

The collector reads every current ledger item name once. It enters the item
name in the auction's **quick search** and submits it with Enter. Names
containing `(` receive one leading space in the submitted query; the exact
listing name is checked while allowing the auction's extra space immediately
before `(`. The collector does not
select the filter-search autocomplete. This matters because the filter search
used in the first trial was limited to armor categories. The collector waits
between requests, verifies the search counter and result heading, and records
the listing count, lowest displayed unit price for an exact-name plain listing
on the first result page, listing summary, and observation time. It stops
rather than guessing when the UI cannot be read or the 100-search daily limit
is reached. A partial same-day run resumes from its saved observations.

Observations are saved under `data/auction-quick-all-YYYY-MM-DD.json` and
`data/auction-quick-all-latest.json`, and under `auction-reports/all-YYYY-MM-DD`
in Firestore. The one-time missing-price collection uses `missing` in place of
`all`. Both the corrected report and the superseded filter-search report from
2026-09-30 were copied to Firestore. The `data` directory is Git-ignored.
The apply step requires a complete report that matches the current ledger and
was completed within six hours. It creates a local JSON ledger backup before changing
prices. Every item in a full run receives an auction source and observation
time. An exact listing without visible upgrade or potential markers gets the
lowest observed unit asking price; zero results or listings that cannot be
matched to a plain exact-name item on the first page get a null price. Earlier
reference or manual item prices do not survive a new auction observation.
Existing drop snapshots and settlements remain unchanged.
Repeated application of the same report does not change the ledger.
The Prices page displays only items with a collected price. Unpriced items
remain in the ledger so the next full run can search them again.

## Superseded filter-search trial — 2026-09-30

The first run used filter search and therefore did not cover all item
categories. Its classification of 44 names as absent from autocomplete is
invalid for general item availability. Ten observed armor-accessory prices
were imported and are retained until the next full quick-search run; the
remaining 57 entries were left without a price. The user requested a one-time
quick search of these 57 missing entries, with future daily runs searching all
67. A pre-update SQLite backup was created and checked against historical drop
records and settlements. The SQLite files were removed after the verified
Firestore migration.

| Item | Imported unit asking price (meso) |
| --- | ---: |
| 루즈 컨트롤 머신 마크 | 1,355,555,000 |
| 컴플리트 언더컨트롤 | 22,300,000,000 |
| 마력이 깃든 안대 | 3,160,000,000 |
| 가디언 엔젤 링 | 3,600,000 |
| 몽환의 벨트 | 3,850,000,000 |
| 거대한 공포 | 4,959,999,999 |
| 창세의 뱃지 | 19,649,999,999 |
| 죽음의 맹세 | 80,000,000,000 |
| 불멸의 유산 | 83,000,000,000 |
| 굶주리는 핏빛 원혼 | 100,000,000,000 |

The first filter-search listings for `고통의 근원`, `근원의 속삭임`, and
`황홀한 악몽` had visible option markers and were not imported.

## One-time missing-price quick search — 2026-09-30

At the owner's request, only the 57 entries without a price were queried by
quick search. The auction counter advanced from 32/100 to 89/100. Fourteen
entries received an exact-name plain listing price; 37 searches returned zero
results, two first pages had only visibly optioned exact-name listings, and
four first pages did not contain an exact-name listing. The 57 observations
were applied to the live ledger, taking it from revision 1645 to 1646. The ten
earlier filter-search prices were retained until the first full quick-search
refresh. The ledger now has 24 priced and 43 unpriced auction items. The
application created a SQLite backup at the time; drops, settlements, bosses,
characters, and settings were checked against it and remained unchanged. The
SQLite files were removed after the verified Firestore migration.

| Item | Observed unit asking price (meso) |
| --- | ---: |
| 루인 포스실드 | 3,444,444 |
| 트와일라이트 마크 | 500,000 |
| 거울세계의 코어 젬스톤 | 380,000 |
| 에스텔라 이어링 | 999,999 |
| 데이브레이크 펜던트 | 10,500,000 |
| 고통의 근원 | 5,530,000,000 |
| 커맨더 포스 이어링 | 1,430,000,000 |
| 미트라의 코어 젬스톤 | 1,250,000 |
| 생명의 연마석 | 1,019,999,000 |
| 1단계 소울 에테르 | 920,000,000 |
| 신념의 연마석 | 3,380,000,000 |
| 3단계 소울 에테르 | 1,569,999,999 |
| 2단계 소울 에테르 | 1,517,999,999 |
| 4단계 소울 에테르 | 3,299,999,999 |

These are current asking prices, not completed sale prices. The UI shows the
world and that options are not fully verified. A zero result does not prove
that an item is untradeable.

## Parenthesis-name correction — 2026-09-30

Five still-unpriced names containing `(` were quick-searched with one leading
space. The auction displayed an additional space before `(` in three exact
listing names, so the matcher initially missed them. A second inspection of
those three result pages confirmed the plain first cards and their prices.
The corrected report is stored in Firestore as
`auction-reports/parentheses-2026-09-30`, and its prices were applied at live
ledger revision 1648. The other two names returned zero results. The auction
counter ended at 97/100. The ledger now has 27 priced and 40 unpriced items;
the 40 unpriced items are hidden only from the Prices page.

| Item | Observed unit asking price (meso) |
| --- | ---: |
| 익셉셔널 해머(벨트) | 7,400,000,000 |
| 익셉셔널 해머(얼굴장식) | 6,439,999,998 |
| 익셉셔널 해머(눈장식) | 32,999,999,979 |

## Dots schedule status

The 10:00 Asia/Seoul Dots schedule has **not** been created from this Codex
session. No Dots scheduling capability is connected here. Dots can save
recurring tasks when given a fixed time and time zone, but this local project
and its private Chrome profile require the owner's computer connection and
the ChatGPT desktop app to stay open and online for local work. See the
[official Dots task guide](https://learn.chatgpt.com/docs/dots/tasks-and-memory)
and [computer connection guide](https://learn.chatgpt.com/docs/dots/computers-and-apps).

Once that computer is connected to the owner's dot, send it this instruction:

> Every day at 10:00 Asia/Seoul, use my connected computer to run
> `npm run auction:refresh` in
> `/Users/byoungyoonlee/orca/projects/maple`. Confirm the saved schedule.
> After each run, check the JSON report and live ledger counts, and report
> quoted, unavailable, optioned, and failed items in ChatGPT. Do not purchase
> or sell items. If login, OTP, security checks, or the auction search limit
> blocks collection, stop and ask me to resolve it; do not apply a partial
> report. Never copy `.env` or the Chrome profile to the cloud.

After Dots confirms the saved schedule, verify it under **Scheduled** in the
dot's profile. The Prices page currently labels 10:00 as the target run time,
not an active schedule.
