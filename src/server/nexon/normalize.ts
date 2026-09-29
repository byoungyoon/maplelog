import { applyCatalogue, catalogCrystal } from "@/server/catalog";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { ensure, type Ledger, type Cycle } from "@/domain/model";
import { observe } from "@/domain/commands";
import type { schedulerResponse } from "./scheduler";
export type SchedulerData = z.infer<typeof schedulerResponse>;
const cycles: Record<string, Cycle> = {
  bossWeekly: "weekly",
  bossMonthly: "monthly",
  bossDaily: "daily",
};
const difficulties: Record<string, string> = {
  easy: "이지",
  normal: "노멀",
  hard: "하드",
  chaos: "카오스",
  extreme: "익스트림",
};
const identifier = (...parts: string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
// Group by the observed content name + cycle. Never count several difficulty flags as several kills.
export function mergeScheduler(
  book: Ledger,
  characterId: string,
  data: SchedulerData,
  detectedAt = new Date().toISOString(),
) {
  const date = new Date(
    data.date.length === 10 ? `${data.date}T00:00:00+09:00` : data.date,
  );
  ensure(
    Number.isFinite(date.getTime()),
    "스케줄러 기준 날짜를 확인할 수 없어요.",
    502,
  );
  const sourceAsOf = date.toISOString();
  const previous = book.sync.characters?.find(
    (c) => c.characterId === characterId,
  );
  if (previous?.sourceAsOf && previous.sourceAsOf > sourceAsOf) return;
  const initial = !previous?.sourceAsOf;
  const groups = new Map<string, SchedulerData["boss_contents"]>();
  let unsupported = 0;
  for (const row of data.boss_contents) {
    if (!cycles[row.cycle] || !difficulties[row.difficulty]) {
      unsupported++;
      continue;
    }
    const group = `nexon:${identifier(row.content_name, row.cycle)}`;
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  for (const [group, rows] of groups) {
    for (const row of rows) {
      const id = `nexon:${identifier(group, row.difficulty)}`;
      if (!book.bosses.some((b) => b.id === id))
        book.bosses.push({
          id,
          name: row.content_name,
          group,
          cycle: cycles[row.cycle],
          difficulty: difficulties[row.difficulty],
          crystal: null,
          items: [],
          icon: "shield",
          ruleVersion: "nexon-observed-v1",
        });
    }
    applyCatalogue(book, detectedAt);
    const done = rows.filter((r) => r.complete_flag === "true");
    const selected =
      done[0] ?? rows.find((r) => r.registration_flag === "true") ?? rows[0];
    const boss = book.bosses.find(
      (b) => b.id === `nexon:${identifier(group, selected.difficulty)}`,
    )!;
    let plan = book.plans.find(
      (p) =>
        p.characterId === characterId &&
        book.bosses.find((b) => b.id === p.bossId)?.group === group,
    );
    if (!plan) {
      plan = {
        id: `plan:${identifier(characterId, group)}`,
        characterId,
        bossId: boss.id,
        enabled: rows.some(
          (r) => r.registration_flag === "true" || r.complete_flag === "true",
        ),
        party: null,
        difficulty: boss.difficulty,
      };
      book.plans.push(plan);
    }
    // API observation uses the reported difficulty; a user's future plan stays unchanged.
    const observedPlan = {
      ...plan,
      bossId: boss.id,
      difficulty: done.length > 1 ? null : boss.difficulty,
    };
    const index = book.plans.indexOf(plan);
    book.plans[index] = observedPlan;
    const completion = observe(
      book,
      plan.id,
      sourceAsOf,
      done.length > 0,
      initial,
    );
    book.plans[index] = plan;
    if (completion) {
      if (
        completion.detectedAt === sourceAsOf &&
        boss.crystalSource === "scouter" &&
        completion.party &&
        completion.difficulty
      ) {
        const price = catalogCrystal(boss.name, boss.difficulty, sourceAsOf);
        completion.crystal = price
          ? (BigInt(price) / BigInt(completion.party)).toString()
          : null;
      }
      if (completion.detectedAt === sourceAsOf)
        completion.detectedAt = detectedAt;
      if (done.length > 1) {
        completion.status = "conflict";
        completion.difficulty = null;
        completion.crystal = null;
      }
      if (
        done.length === 1 &&
        completion.difficulty &&
        completion.difficulty !== boss.difficulty
      ) {
        completion.status = "conflict";
      }
    }
  }
  book.sync.characters = book.sync.characters ?? [];
  const status = {
    characterId,
    checkedAt: detectedAt,
    sourceAsOf,
    status: unsupported
      ? ("unsupported" as const)
      : data.boss_contents.length
        ? ("ok" as const)
        : ("empty" as const),
    message: unsupported
      ? `${unsupported}개 항목은 주기 또는 난이도를 확인해야 해요.`
      : data.boss_contents.length
        ? null
        : "넥슨이 빈 보스 목록을 반환했어요. 게임 접속·스케줄러 등록 상태를 확인해 주세요.",
    bossCount: data.boss_contents.length,
    weeklyClearCount: data.weekly_boss_clear_count,
    weeklyClearLimit: data.weekly_boss_clear_limit_count,
  };
  book.sync.characters = book.sync.characters.filter(
    (c) => c.characterId !== characterId,
  );
  book.sync.characters.push(status);
}
