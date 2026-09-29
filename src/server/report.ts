import type { Ledger } from "@/domain/model";
import { entries, summarize } from "@/domain/revenue";
import { periodAt } from "@/domain/period";
export function report(s: Ledger, url: URL, now = new Date()) {
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
    (c) => c.cycle === cycle && c.periodStart === period.start,
  );
  const rows = entries(s, selected);
  const summary = summarize(rows);
  const cash = entries(s).flatMap((e) =>
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
      s.characters.some((c) => c.id === p.characterId) &&
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
  const remainingKnownAmount = remaining
    .reduce((total, plan) => {
      const boss = s.bosses.find((b) => b.id === plan.bossId)!;
      return total +
        (boss.crystal !== null && plan.party && plan.difficulty
          ? BigInt(boss.crystal) / BigInt(plan.party)
          : 0n);
    }, 0n)
    .toString();
  const remainingUnknown = remaining.filter((plan) => {
    const boss = s.bosses.find((b) => b.id === plan.bossId)!;
    return boss.crystal === null || !plan.party || !plan.difficulty;
  }).length;
  return {
    period,
    cycle,
    rows,
    cash,
    summary,
    cashSummary: summarize(cash),
    pending: selected.filter((c) => !c.excluded && c.review === "pending"),
    selected,
    plans,
    remaining: remaining.length,
    remainingAmount,
    remainingKnownAmount,
    remainingUnknown,
    projectedTotal: (BigInt(summary.total) + BigInt(remainingKnownAmount)).toString(),
    characters: s.characters
      .slice()
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
