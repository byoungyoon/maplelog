# External and Internal API Contract

External contracts were checked on 2026-09-29. The user connected their key through the browser. Credentials are not included in responses, logs, or documentation.

## Nexon

Official schema snapshots:

- [Character API schema](https://openapi.nexon.com/static/api/maplestory/14_ko_script20260917040003.yaml)
- [Scheduler API schema](https://openapi.nexon.com/static/api/maplestory/62_ko_script20260821005015.yaml)

| Endpoint                                   | Input                                 | Verified response fields                                                                                                   |
| ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/maplestory/v1/character/list`            | Server-side `x-nxopen-api-key` header | `account_list[].account_id`, `character_list[].ocid`, `character_name`, `world_name`, `character_class`, `character_level` |
| `/maplestory/v1/character/basic`           | `ocid`                                | `character_image`, `character_level`, `character_class`                                                                    |
| `/maplestory/v1/scheduler/character-state` | `ocid`, optional `date`               | `date`, `boss_contents`, `weekly_boss_clear_count`, `weekly_boss_clear_limit_count`                                        |

All three endpoints were verified with real responses. An initial sample of five characters returned two nonempty scheduler results and three empty lists, yielding 24 completion records.

Scheduler entries include `content_name`, `difficulty`, `cycle`, `list_order_no`, `registration_flag`, and `complete_flag`. Flags are strings (`"true"` and `"false"`), not booleans. The adapter handles `bossWeekly`, `bossMonthly`, and `bossDaily`; unsupported cycles or difficulties are marked for review without generating income. One observed date format was `2026-09-29T00:00+09:00`.

Records sharing a content name and cycle belong to the same group. Simultaneous completions at multiple difficulties produce one conflict record. Actual kill time remains null; detection time and source date are separate. The first import uses `initial` provenance. Regression, empty responses, and errors do not delete prior records.

Periods use KST: weekly at Thursday midnight, daily at midnight, and monthly on the first day. Special boss exceptions need further confirmation. The adapter accepts historical dates, but automatic 14-day backfill is not implemented.

Official references: [scheduler notice](https://openapi.nexon.com/ko/support/notice/3482567/), [limits](https://openapi.nexon.com/ko/support/faq/2354215/), and [scheduler documentation](https://openapi.nexon.com/ko/game/maplestory/?id=57).

## MapleScouter Catalog

Public literals from [boss data](https://maplescouter.com/ko/boss-data) and [boss income](https://maplescouter.com/ko/boss-income) were parsed without executing remote JavaScript. The snapshot contains 58 crystal price variants, 73 reward image metadata entries, and 124 downloaded images.

These are prominent reward candidates, not an exhaustive drop table. Seven lower-tier boss images and four reward images were unavailable and use fallback icons. Crystal values follow the September 17 update, with the separate October 1 Black Mage transition retained. Manual crystal values are never overwritten.

Version and source metadata are stored in `src/data/scouter-catalog.json`.

## Item Reference Prices

Public endpoint: [MapleScouter item prices](https://api.maplescouter.com/api/archive/item-price).

The response shape is `success: true` with `item_price: { itemName: numericString }`. Amounts in units of 100 million meso are converted to integer meso using BigInt, with up to eight decimal places. For example, `38` becomes `3800000000`. The checked snapshot is stored in `src/data/scouter-item-prices.json`.

The source does not provide world, item-option, or supplier-update metadata. Displayed timestamps indicate when this app fetched the response. Only exact item names are matched; abbreviations are not expanded speculatively. Personal-bound rewards are not automatically made tradable. Other priced shared rewards use the assumption of tradability immediately after acquisition, which can be edited in drop details.

The provider receives no Nexon key or character information. The worker refreshes daily, while manual refreshes are coalesced with a 60-second cooldown. Failures preserve the last prices and show an error. Manual values and existing drop price snapshots are preserved.

## Internal API

`GET book`, `sync/status`, `connection/status`, and `export` are read-only. `POST connection/verify` validates a key and starts loading all characters. `connection/disconnect` removes the credential. `sync/request` supports a full refresh or a requested `characterId` when opening an unqueried character.

Commands use a validated discriminated union, ledger revision, and request ID. Restore uses `import/preview` followed by `import/commit`. Before key connection, private ledger endpoints return 428. Demo mode returns 404. Public deployments require owner authentication for ledger, setup, and credential endpoints.

## Completion-Based Reporting

Since 2026-09-30, reports and CSV exports use completed boss crystals and acquired drops, at a one-person share. Remaining boss estimates are separate. Character searches do not change account-wide reporting scope.

Paid/unpaid filters and cash-date reporting have been removed. The HTTP API rejects `settle`, `crystal-settle`, and `cancel-settlement`. Historical payment records and legacy domain helpers remain only for backup compatibility; they do not affect current income or prevent editing acquired drop quantities.
