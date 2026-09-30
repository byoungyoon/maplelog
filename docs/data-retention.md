# Data Refresh and Retention

The footer credits Nexon Open API. The current-state cache and user-authored ledger are treated separately, based on the refresh guidance in the [official data documentation](https://openapi.nexon.com/ko/game/maplestory/?id=14).

- Do not persist raw HTTP responses, plaintext keys, or raw character diagnostic logs.
- Keep the latest observed boss state for each queried character. Refresh the character image cache after 24 hours.
- Refresh the account character list when connecting or reconnecting a key. Periodic character roster refresh is not implemented, so newly created characters may require reconnection.
- Drops, preferences, and historical payment records are user-authored ledger data. The permitted long-term retention of historical records derived from API observations has not been conclusively established; indefinite retention is not asserted.
- Disconnecting removes the encrypted credential and stops tracking while preserving ledger records. Backup and deletion controls are available on the Settings route, which is not in the primary navigation.
- Before broader deployment, confirm stale account cache handling and the retention rules for derived historical records.

Verification has focused on personal local use. The app does not collect other users' credentials or operate a raw-data archive.
