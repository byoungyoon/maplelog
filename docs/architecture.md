# Architecture

The frontend follows the `area/action/state/lib/component` pattern from the user's `batch/re-qu-test` project, particularly its clinic page implementation.

App Router `page.tsx` files compose feature areas. Features live under `src/features/<feature>`:

- `_area`: meaningful page regions that compose actions and presentation components.
- `_action`: components and hooks that connect user events to mutations. This name does not imply a Next.js Server Action.
- `_state`: TanStack Query hooks and Zustand UI state.
- `_lib`: HTTP helpers and pure transformations.
- `_component`: presentation components driven by props.

`src/shared` uses the same organization for shared functionality. TanStack Query owns server data; Zustand owns UI selections. Server records and derived totals are not duplicated in Zustand.

`src/domain` contains validation and calculations. `src/server` contains persistence, authentication, external API adapters, and reporting. Firestore stores the compressed aggregate ledger, encrypted API key, leases, budgets, analysis cache, and auction reports. Signed login sessions carry the Nexon account signature; request-scoped Firestore access keeps each new account under `accounts/{accountSignature}`. The migrated owner's data remains in root collections and is selected only for that account signature. Server-side transactions enforce revision checks and request IDs for conflict detection and idempotency. Direct client Firestore access is denied by rules.

Current reports use `completionEntries` to calculate income without historical payment records. The legacy payment model remains readable for backup compatibility, while HTTP payment commands are rejected.
