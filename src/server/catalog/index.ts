import { createHash } from "node:crypto";
import catalog from "@/data/scouter-catalog.json" with { type: "json" };
import type { Ledger } from "@/domain/model";
const normalized = (s: string) =>
  s.replace(/^시즌 보스\s*/, "").replace(/\s/g, "");
export function catalogBoss(name: string, difficulty: string) {
  return catalog.bosses.find(
    (b) =>
      normalized(b.name) === normalized(name) && b.difficulty === difficulty,
  );
}
export function catalogCrystal(
  name: string,
  difficulty: string,
  at = new Date().toISOString(),
) {
  const b = catalogBoss(name, difficulty);
  return b ? (at >= b.effectiveAt ? b.crystal : b.crystalBefore) : null;
}
export function applyCatalogue(book: Ledger, at = new Date().toISOString()) {
  let changed = false;
  for (const boss of book.bosses) {
    const match = catalogBoss(boss.name, boss.difficulty);
    if (!match) continue;
    if (boss.image !== match.image) {
      boss.image = match.image;
      changed = true;
    }
    const price = catalogCrystal(boss.name, boss.difficulty, at);
    if (
      boss.crystalSource !== "manual" &&
      (boss.crystal !== price || boss.crystalSource !== "scouter")
    ) {
      boss.crystal = price;
      boss.crystalSource = "scouter";
      boss.crystalCheckedAt = catalog.checkedAt;
      changed = true;
    }
    for (const reward of match.rewards) {
      const itemId = `scouter:${createHash("sha256").update(reward.name).digest("hex").slice(0, 24)}`;
      const meta = catalog.items.find((i) => i.name === reward.name);
      if (!book.items.some((i) => i.id === itemId)) {
        book.items.push({
          id: itemId,
          name: reward.name,
          image: meta?.image ?? null,
          icon: reward.name.includes("상자") ? "box" : "gem",
          price: null,
          source: "scouter",
          observedAt: `${catalog.checkedAt}T00:00:00.000Z`,
          market: "시장 확인 필요",
          variant: reward.personal
            ? "개인 귀속 보상 · 거래 조건 확인 필요"
            : "거래 조건 확인 필요",
          tradable: false,
          tradeConfirmed: false,
        });
        changed = true;
      }
      if (!boss.items.includes(itemId)) {
        boss.items.push(itemId);
        changed = true;
      }
    }
  }
  return changed;
}
export const catalogStatus = {
  source: catalog.source,
  priceSource: catalog.priceSource,
  checkedAt: catalog.checkedAt,
  priceVersion: catalog.priceVersion,
};
