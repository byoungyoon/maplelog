import type { Ledger } from "./model";

/** Personal ledger policy. Never rewrite an amount that was already settled. */
export function applySoloPolicy(book: Ledger) {
  if (book.mode !== "live") return false;
  let changed = false;
  for (const plan of book.plans) {
    if (plan.party !== 1) {
      plan.party = 1;
      changed = true;
    }
  }
  for (const c of book.completions) {
    if (
      c.party === 1 ||
      book.settlements.some(
        (s) => !s.deleted && s.kind === "crystal" && s.targetId === c.id,
      )
    )
      continue;
    const boss = book.bosses.find((b) => b.id === c.bossId);
    if (c.status !== "conflict" && c.difficulty) {
      c.crystal =
        c.crystal !== null && c.party
          ? (BigInt(c.crystal) * BigInt(c.party)).toString()
          : (boss?.crystal ?? null);
    }
    c.party = 1;
    changed = true;
  }
  for (const drop of book.drops) {
    if (drop.share !== 1 || drop.shared) {
      drop.share = 1;
      drop.shared = false;
      changed = true;
    }
  }
  return changed;
}
