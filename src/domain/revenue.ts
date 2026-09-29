import { type Ledger, type Completion } from "./model";
import { estimate } from "./money";
export interface Entry {
  id: string;
  kind: "crystal" | "drop";
  completionId: string;
  characterId: string;
  bossId: string;
  name: string;
  quantity: number;
  remaining: number;
  actual: string;
  expected: string | null;
  total: string;
  unknown: boolean;
  excluded: boolean;
  source: string;
  settledIds: string[];
}
export function entries(
  s: Ledger,
  completions: Completion[] = s.completions,
): Entry[] {
  const output: Entry[] = [];
  for (const c of completions) {
    const b = s.bosses.find((b) => b.id === c.bossId)!;
    const make = (
      id: string,
      kind: Entry["kind"],
      name: string,
      quantity: number,
      used: number,
      unit: string | null,
      tradable: boolean,
      fee = 0,
      cost = "0",
      share: number | null = 1,
    ) => {
      const ss = s.settlements.filter(
        (x) => !x.deleted && x.kind === kind && x.targetId === id,
      );
      const actual = ss.reduce((a, x) => a + BigInt(x.net), 0n);
      const remaining =
        quantity - used - ss.reduce((a, x) => a + x.quantity, 0);
      const excluded = c.excluded || !tradable;
      const expected = excluded
        ? 0n
        : estimate(unit, remaining, fee, cost, share);
      output.push({
        id,
        kind,
        completionId: c.id,
        characterId: c.characterId,
        bossId: c.bossId,
        name,
        quantity,
        remaining,
        actual: actual.toString(),
        expected: expected?.toString() ?? null,
        total: (actual + (expected ?? 0n)).toString(),
        unknown: expected === null,
        excluded,
        source: c.provenance,
        settledIds: ss.map((x) => x.id),
      });
    };
    make(c.id, "crystal", `${b.name} 결정석`, 1, 0, c.crystal, true);
    s.drops
      .filter((d) => d.completionId === c.id && d.quantity > 0)
      .forEach((d) =>
        make(
          d.id,
          "drop",
          s.items.find((i) => i.id === d.itemId)!.name,
          d.quantity,
          d.used,
          d.currentQuote ? d.currentQuote.unitPrice : d.unitPrice,
          d.tradable,
          d.feeBps,
          d.cost,
          d.shared ? d.share : 1,
        ),
      );
  }
  return output;
}
export function summarize(rows: Entry[]) {
  const sum = (f: (x: Entry) => string) =>
    rows.reduce((a, x) => a + BigInt(f(x)), 0n).toString();
  return {
    total: sum((x) => x.total),
    actual: sum((x) => x.actual),
    expected: sum((x) => x.expected ?? "0"),
    crystal: sum((x) => (x.kind === "crystal" ? (x.expected ?? "0") : "0")),
    drop: sum((x) => (x.kind === "drop" ? (x.expected ?? "0") : "0")),
    unknown: rows.filter((x) => x.unknown).length,
  };
}

export function bossEarnings(s: Ledger, completions: Completion[]) {
  const groups = new Map<string, Completion[]>();
  for (const completion of completions) {
    if (completion.excluded) continue;
    groups.set(completion.group, [
      ...(groups.get(completion.group) ?? []),
      completion,
    ]);
  }
  return [...groups].map(([group, records]) => {
    const boss = s.bosses.find((item) => item.id === records[0].bossId)!;
    const summary = summarize(entries(s, records));
    return {
      group,
      boss,
      records,
      characterCount: new Set(records.map((record) => record.characterId)).size,
      difficulties: [...new Set(records.map((record) => record.difficulty ?? "확인 필요"))],
      ...summary,
    };
  });
}
