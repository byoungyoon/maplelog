import { describe, expect, it } from "vitest";
import {
  arcaneMultiplier,
  authenticMultiplier,
  calculateBossCuts,
  classifyCut,
  levelMultiplier,
  splineInverse,
  splineValue,
} from "@/domain/boss-cut";
import { strongestCharacter } from "@/features/bosses/_lib/strongestCharacter";
import type { Character } from "@/domain/model";
import fixture from "./fixtures/boss-analysis.json";
import golden from "./fixtures/boss-cut-golden.json";
const calculate = (raw: unknown = fixture) =>
  calculateBossCuts(raw, "테스트캐릭터", "테스트월드");
describe("boss cut computation", () => {
  it("matches all 47 results independently executed from the public client math on 2026-09-30", () => {
    const result = calculate();
    expect(result.cuts).toHaveLength(golden.length);
    for (const row of golden) {
      const actual = result.cuts.find((c) => c.key === row.key)!;
      expect(actual.effectiveStat, row.key).toBe(row.effectiveStat);
      expect(actual.status, row.key).toBe(row.status);
      expect(actual.rate, row.key).toBeCloseTo(row.rate, 9);
      expect(Number.isFinite(actual.minimumStat)).toBe(true);
      expect(actual.effectiveStat >= actual.minimumStat, row.key).toBe(
        actual.status.startsWith("솔플"),
      );
    }
  });
  it("rejects unavailable, mismatched and malformed character results instead of substituting sample data", () => {
    expect(() =>
      calculate({ calculatedData: { error: "크확 100%미만" } }),
    ).toThrow("크확");
    expect(() => calculate({})).toThrow("계산 형식");
    expect(() =>
      calculateBossCuts(fixture, "다른캐릭터", "테스트월드"),
    ).toThrow("일치");
    const raw = structuredClone(fixture);
    raw.calculatedData.spline_300.x.reverse();
    expect(() => calculate(raw)).toThrow("계산 형식");
  });
  it("applies level and force boundaries exactly", () => {
    expect(levelMultiplier(-50)).toBe(0);
    expect(levelMultiplier(-6)).toBe(0.85);
    expect(levelMultiplier(-5)).toBe(0.875);
    expect(levelMultiplier(-1)).toBe(1.053);
    expect(levelMultiplier(10)).toBe(1.2);
    expect(arcaneMultiplier(100, 99)).toBe(0.8);
    expect(arcaneMultiplier(100, 100)).toBe(1);
    expect(arcaneMultiplier(100, 150)).toBe(1.5);
    expect(authenticMultiplier(100, 9)).toBe(0.05);
    expect(authenticMultiplier(100, 10)).toBe(0.1);
    expect(authenticMultiplier(100, 99)).toBe(0.9);
    expect(authenticMultiplier(100, 150)).toBe(1.25);
  });
  it("keeps party-only thresholds distinct from solo eligibility and blocks entry by level", () => {
    expect(classifyCut(0.899, false, 6)).toBe("파티격 가능");
    expect(classifyCut(0.9, false, 6)).toBe("솔플 최소컷");
    expect(classifyCut(0.9, true, 3)).toBe("3인 최소컷");
    expect(classifyCut(2.7, true, 3)).toBe("솔플 최소컷");
    expect(classifyCut(5.1, true, 6)).toBe("솔플 최소컷");
    const raw = structuredClone(fixture);
    raw.userStat.stat.level = 200;
    expect(
      calculate(raw).cuts.find((c) => c.key === "seren_hard")?.status,
    ).toBe("입장 불가능");
  });
  it("round-trips spline interpolation and extrapolation", () => {
    const curve = { x: [0, 100, 200], y: [0, 200, 400], m: [2, 2, 2] };
    for (const n of [-20, 0, 75, 200, 250])
      expect(splineInverse(curve, splineValue(curve, n))).toBe(n);
  });
});
it("selects power before level, handles missing power and never mutates the roster", () => {
  const char = (id: string, level: number, power?: string): Character => ({
    id,
    name: id,
    world: "test",
    job: "test",
    level,
    combatPower: power,
    order: 0,
    avatar: 0,
    managed: false,
    favorite: false,
  });
  const roster = [
    char("high-level", 290, "900"),
    char("strongest", 280, "1000"),
    char("unknown", 300),
  ];
  expect(strongestCharacter(roster)?.id).toBe("strongest");
  expect(roster[0].id).toBe("high-level");
  expect(strongestCharacter([char("low", 200), char("high", 280)])?.id).toBe(
    "high",
  );
  expect(strongestCharacter([])).toBeUndefined();
});

it("marks only this character's current, confirmed boss difficulty as cleared", async () => {
  const { emptyLedger } = await import("@/domain/empty-ledger");
  const { mergeScheduler } = await import("@/server/nexon/normalize");
  const { completedBossKeys } =
    await import("@/features/bosses/_lib/completedBossKeys");
  const book = emptyLedger();
  book.characters.push({
    id: "a",
    name: "test",
    world: "test",
    job: "test",
    level: 290,
    managed: true,
    favorite: false,
    avatar: 0,
    order: 0,
  });
  const date = "2026-09-30T01:00:00.000Z";
  mergeScheduler(book, "a", {
    date,
    boss_contents: [
      {
        content_name: "루시드",
        difficulty: "hard",
        cycle: "bossWeekly",
        list_order_no: 1,
        registration_flag: "true",
        complete_flag: "true",
      },
    ],
    weekly_boss_clear_count: 1,
    weekly_boss_clear_limit_count: 12,
  });
  expect([...completedBossKeys(book, "a", Date.parse(date))]).toEqual([
    "lucid_hard",
  ]);
  expect(completedBossKeys(book, "b", Date.parse(date)).size).toBe(0);
  expect(
    completedBossKeys(book, "a", Date.parse("2026-10-08T01:00:00.000Z")).size,
  ).toBe(0);
  book.completions[0].excluded = true;
  expect(completedBossKeys(book, "a", Date.parse(date)).size).toBe(0);
  book.completions[0].excluded = false;
  book.completions[0].status = "conflict";
  expect(completedBossKeys(book, "a", Date.parse(date)).size).toBe(0);
});
