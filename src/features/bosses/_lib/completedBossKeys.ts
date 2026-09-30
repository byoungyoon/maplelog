import type { Ledger } from "@/domain/model";
import { periodAt } from "@/domain/period";
import catalogue from "@/data/scouter-catalog.json";

export function completedBossKeys(
  book: Ledger,
  characterId: string,
  asOf: number,
) {
  const keys = new Set<string>();
  for (const completion of book.completions) {
    if (
      completion.characterId !== characterId ||
      completion.excluded ||
      completion.status !== "complete" ||
      completion.periodStart !==
        periodAt(new Date(asOf), completion.cycle).start
    )
      continue;
    const boss = book.bosses.find((b) => b.id === completion.bossId);
    if (!boss || !completion.difficulty) continue;
    const row = catalogue.bosses.find(
      (b) =>
        b.name.replaceAll(" ", "") === boss.name.replaceAll(" ", "") &&
        b.difficulty === completion.difficulty,
    );
    if (row) keys.add(row.key);
  }
  return keys;
}
