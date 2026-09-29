import type { Ledger } from "@/domain/model";
import { entries, summarize } from "@/domain/revenue";
import { periodAt } from "@/domain/period";
export function report(s: Ledger, url: URL, now = new Date()) {
  const character = url.searchParams.get("character") || "all";
  const cycle =
    url.searchParams.get("cycle") === "daily"
      ? "daily"
      : url.searchParams.get("cycle") === "monthly"
        ? "monthly"
        : "weekly";
  const offset = Math.max(
    -52,
    Math.min(0, Number(url.searchParams.get("offset")) || 0),
  );
  let period = periodAt(now, cycle);
  for (let i = 0; i > Math.trunc(offset); i--)
    period = periodAt(new Date(new Date(period.start).getTime() - 1), cycle);
  const selected = s.completions.filter(
    (c) =>
      (character === "all" || c.characterId === character) &&
      c.cycle === cycle &&
      c.periodStart === period.start,
  );
  const rows = entries(s, selected);
  const cash = entries(s)
    .filter((e) => character === "all" || e.characterId === character)
    .flatMap((e) =>
      s.settlements
        .filter(
          (x) =>
            !x.deleted &&
            x.targetId === e.id &&
            x.kind === e.kind &&
            x.settledAt >= period.start &&
            x.settledAt < period.end,
        )
        .map((x) => ({
          ...e,
          settlementId: x.id,
          settledAt: x.settledAt,
          quantity: x.quantity,
          actual: x.net,
          expected: "0",
          total: x.net,
          remaining: 0,
          unknown: false,
        })),
    );
  const plans = s.plans.filter(
    (p) =>
      p.enabled &&
      (character === "all" || p.characterId === character) &&
      s.characters.some((c) => c.id === p.characterId && c.managed) &&
      s.bosses.some((b) => b.id === p.bossId && b.cycle === cycle),
  );
  const remaining = plans.filter(
    (p) =>
      !selected.some(
        (c) =>
          c.characterId === p.characterId &&
          c.group === s.bosses.find((b) => b.id === p.bossId)?.group,
      ),
  );
  const remainingAmount = remaining.some((p) => {
    const b = s.bosses.find((b) => b.id === p.bossId)!;
    return b.crystal === null || !p.party || !p.difficulty;
  })
    ? null
    : remaining
        .reduce((a, p) => {
          const b = s.bosses.find((b) => b.id === p.bossId)!;
          return (
            a +
            (b.crystal && p.party && p.difficulty
              ? BigInt(b.crystal) / BigInt(p.party)
              : 0n)
          );
        }, 0n)
        .toString();
  return {
    period,
    cycle,
    rows,
    cash,
    summary: summarize(rows),
    cashSummary: summarize(cash),
    pending: selected.filter((c) => !c.excluded && c.review === "pending"),
    selected,
    plans,
    remaining: remaining.length,
    remainingAmount,
    characters: s.characters
      .filter((c) => c.managed)
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const cs = selected.filter((x) => x.characterId === c.id);
        return {
          ...c,
          summary: summarize(entries(s, cs)),
          done: cs.length,
          planned: plans.filter((p) => p.characterId === c.id).length,
          pending: cs.filter((x) => x.review === "pending" && !x.excluded)
            .length,
        };
      }),
  };
}
export type Report = ReturnType<typeof report>;
