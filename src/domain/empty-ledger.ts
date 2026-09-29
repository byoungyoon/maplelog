import type { Ledger } from "./model";
export function emptyLedger(): Ledger {
  return {
    schemaVersion: 1,
    mode: "live",
    revision: 0,
    characters: [],
    bosses: [],
    items: [],
    plans: [],
    completions: [],
    drops: [],
    settlements: [],
    audit: [],
    sync: {
      lastSuccess: null,
      error: null,
      focusCharacter: null,
      focusUntil: null,
      lastRequest: null,
      workerSeen: null,
    },
    settings: { setupDone: false, dailyBudget: 800, staleHours: 12 },
  };
}
