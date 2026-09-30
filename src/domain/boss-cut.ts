import { z } from "zod";
import catalogue from "@/data/scouter-boss-cuts.json" with { type: "json" };
import { DomainError, ensure } from "./model";

const finite = z.number().finite();
const positive = finite.positive();
const splineSchema = z
  .object({
    x: z.array(finite).min(2).max(200),
    y: z.array(finite).min(2).max(200),
    m: z.array(finite).min(2).max(200),
  })
  .refine(
    ({ x, y, m }) =>
      x.length === y.length &&
      x.length === m.length &&
      x.every((v, i) => !i || v > x[i - 1]) &&
      y.every((v, i) => !i || v > y[i - 1]),
  );
type Spline = z.infer<typeof splineSchema>;
export const scouterCharacterSchema = z.object({
  calculatedData: z.object({
    calculatedHexaDamage_300: positive,
    calculatedHexaDamage_380: positive,
    calculatedDamage_380: positive,
    calculatedHexaDamage_kaling: finite.optional(),
    boss300_hexaStat: positive,
    boss380_hexaStat: positive,
    spline_300: splineSchema,
    spline_380: splineSchema,
    ignoreDefConst_300: positive,
    ignoreDefConst_380: positive,
    genePassConst: positive.optional(),
    ascent_const: finite.min(0).max(1),
    elixir: z.number().int().min(0).max(3),
    specEfficiency: z.object({
      cridmgeff1: finite,
      atkeff1: finite,
      dmgeff1: finite,
      mainStateff1: finite,
      atkPereff1: finite,
    }),
  }),
  userApiData: z.object({
    date: z.string().nullable(),
    info: z.object({ character_name: z.string(), world_name: z.string() }),
    symbol: z.record(z.string(), z.object({ level: z.number().nonnegative() })),
  }),
  userStat: z.object({
    stat: z.object({
      myClass: z.string(),
      level: z.coerce.number().int().min(1).max(400),
      arcaneForce: z.coerce.number().nonnegative(),
      authenticForce: z.coerce.number().nonnegative(),
    }),
  }),
});

// Hermite interpolation and inversion of the provider's character-specific curve.
export function splineValue(curve: Spline, value: number): number {
  const { x, y, m } = curve;
  const last = x.length - 1;
  if (value < x[0]) return y[0] + (value - x[0]) * m[0];
  if (value > x[last])
    return y[last] + (value - x[last]) * Math.max(m[last], 1e-9);
  const interval = Math.max(
    0,
    x.findIndex((right, i) => i > 0 && value <= right) - 1,
  );
  const width = x[interval + 1] - x[interval];
  const t = (value - x[interval]) / width;
  return (
    (2 * t ** 3 - 3 * t ** 2 + 1) * y[interval] +
    (t ** 3 - 2 * t ** 2 + t) * width * m[interval] +
    (-2 * t ** 3 + 3 * t ** 2) * y[interval + 1] +
    (t ** 3 - t ** 2) * width * m[interval + 1]
  );
}
export function splineInverse(curve: Spline, damage: number): number {
  const last = curve.x.length - 1;
  if (damage <= curve.y[0])
    return Math.round(
      curve.x[0] + (damage - curve.y[0]) / Math.max(curve.m[0], 1e-9),
    );
  if (damage >= curve.y[last])
    return Math.round(
      curve.x[last] + (damage - curve.y[last]) / Math.max(curve.m[last], 1e-9),
    );
  let lo = curve.x[0],
    hi = curve.x[last];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (splineValue(curve, mid) < damage) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}
export function levelMultiplier(delta: number) {
  if (delta >= 0) return (110 + 2 * Math.min(5, delta)) / 100;
  if (delta >= -5) return [1.1, 1.053, 1.007, 0.962, 0.918, 0.875][-delta];
  return Math.max(0, (100 + delta * 2.5) / 100);
}
export function arcaneMultiplier(required: number, force: number) {
  if (!required) return 1;
  const ratio = force / required;
  const thresholds = [0.1, 0.3, 0.5, 0.7, 1, 1.1, 1.3, 1.5];
  const values = [0.1, 0.3, 0.6, 0.7, 0.8, 1, 1.1, 1.3, 1.5];
  const index = thresholds.findIndex((v) => ratio < v);
  return values[index < 0 ? 8 : index];
}
export function authenticMultiplier(required: number, force: number) {
  if (!required) return 1;
  const gap = force - required;
  if (gap < -90) return 0.05;
  if (gap < 0) return (Math.floor(gap / 10) + 10) / 10;
  return 1 + Math.min(5, Math.floor(gap / 10)) * 0.05;
}
const symbolByBoss: Record<string, string> = {
  seren: "authentic_symbol_1",
  kalos: "authentic_symbol_2",
  adversary: "authentic_symbol_3",
  kaling: "authentic_symbol_4",
  maleficStar: "authentic_symbol_5",
  limbo: "authentic_symbol_6",
  bardrix: "grand_authentic_symbol_1",
  jupiter: "grand_authentic_symbol_2",
};

function elixirCorrection(data: z.infer<typeof scouterCharacterSchema>) {
  const c = data.calculatedData;
  if (c.elixir === 1 || c.elixir === 3) return 1;
  const job = data.userStat.stat.myClass,
    e = c.specEfficiency;
  const bowBuff = [
    "보우마스터",
    "신궁",
    "패스파인더",
    "윈드브레이커",
    "와일드헌터",
  ].includes(job);
  const factor =
    (1 + (bowBuff ? 0 : 8) * e.cridmgeff1) *
    (1 + (job === "비숍" ? 0 : 30) * e.atkeff1) *
    (1 + (job === "비숍" ? 0 : 10) * e.dmgeff1) *
    (1 + (job === "데몬어벤져" ? 1275 : 0) * e.mainStateff1) *
    (1 + (bowBuff ? 0 : 2.35) * e.cridmgeff1) *
    (1 + (job === "와일드헌터" ? 0 : 10) * e.atkPereff1);
  return (20 * factor) / (15 * factor + 5);
}

export function classifyCut(
  rate: number,
  partyReference: boolean,
  partyLimit: number,
) {
  if (partyReference) {
    const boundaries =
      partyLimit === 3
        ? ([
            [2.7, "솔플 최소컷"],
            [1.35, "2인 최소컷"],
            [0.9, "3인 최소컷"],
          ] as const)
        : ([
            [5.1, "솔플 최소컷"],
            [2.55, "2인 최소컷"],
            [1.7, "3인 최소컷"],
            [1.275, "4인 최소컷"],
            [0.9, "6인 최소컷"],
          ] as const);
    return boundaries.find(([min]) => rate >= min)?.[1] ?? "불가능";
  }
  if (rate >= 2) return "솔플 여유컷";
  if (rate >= 1.1) return "솔플 가능";
  if (rate >= 0.9) return "솔플 최소컷";
  const party = (
    { 6: [0.25, 0.15], 3: [0.36, 0.3], 2: [0.55, 0.45] } as Record<
      number,
      number[]
    >
  )[partyLimit];
  if (party && rate >= party[0]) return "파티격 가능";
  if (party && rate >= party[1]) return "파티 최소컷";
  return "불가능";
}

export function calculateBossCuts(raw: unknown, name: string, world: string) {
  const invalid = z
    .object({ calculatedData: z.object({ error: z.string().min(1) }) })
    .safeParse(raw);
  if (invalid.success)
    throw new DomainError(
      `환산 계산 조건을 확인해 주세요: ${invalid.data.calculatedData.error.slice(0, 100)}`,
      422,
    );
  const result = scouterCharacterSchema.safeParse(raw);
  ensure(
    result.success,
    "환산 데이터가 없거나 계산 형식이 변경됐어요. 원본에서 스펙 설정을 확인해 주세요.",
    422,
  );
  const data = result.data,
    c = data.calculatedData,
    stat = data.userStat.stat;
  ensure(
    data.userApiData.info.character_name === name &&
      data.userApiData.info.world_name === world,
    "환산 캐릭터 정보가 일치하지 않아 계산하지 않았어요.",
    422,
  );
  const rows = world.includes("챌린저스")
    ? catalogue.challengers
    : catalogue.bosses;
  const maxSymbol = Object.entries(data.userApiData.symbol).some(
    ([key, value]) => key.includes("authentic_symbol") && value.level >= 11,
  );
  const forceConversion =
    ((c.calculatedHexaDamage_300 / c.ignoreDefConst_300) *
      c.ignoreDefConst_380) /
    c.calculatedHexaDamage_380;
  const correction = elixirCorrection(data);
  const cuts = rows.map((boss) => {
    const code = boss.key.split("_")[0];
    let damage =
      boss.guard === 300
        ? c.calculatedHexaDamage_300
        : c.calculatedHexaDamage_380;
    if (code === "slime") damage /= c.genePassConst ?? 1;
    if (code === "kaling")
      damage = c.calculatedHexaDamage_kaling || c.calculatedHexaDamage_380;
    if (code === "maerin")
      damage =
        0.95 * c.calculatedHexaDamage_380 + 0.05 * c.calculatedDamage_380;
    if (
      boss.guard === 380 &&
      maxSymbol &&
      !(data.userApiData.symbol[symbolByBoss[code]]?.level >= 11)
    )
      damage *= forceConversion;
    const level = levelMultiplier(stat.level - boss.level);
    const arcane = arcaneMultiplier(
      boss.arcaneForce,
      Math.min(1750, stat.arcaneForce),
    );
    const authentic = authenticMultiplier(
      boss.authenticForce,
      stat.authenticForce,
    );
    const baseline =
      1.2 *
      (boss.arcaneForce ? (code === "blackMage" ? 1.1 : 1.5) : 1) *
      (boss.authenticForce ? 1.25 : 1);
    const effectiveDamage =
      ((damage * level * arcane * authentic) / baseline) * correction;
    const curve = boss.guard === 300 ? c.spline_300 : c.spline_380;
    const targetDamage = splineValue(curve, boss.referenceStat);
    ensure(targetDamage > 0, "보스 기준 피해량을 확인할 수 없어요.", 422);
    const baseRate = (effectiveDamage / targetDamage) * boss.rate;
    const ascent = c.ascent_const === 1 ? 0 : c.ascent_const;
    const rateWithAscent = (base: number) => {
      const bursts =
        code === "lucid" && boss.difficulty === "하드"
          ? 0.4
          : Math.min(3, Math.ceil(20 / base / 5.667));
      return Math.max(0, base * (1 + (3 * ascent) / bursts - ascent));
    };
    const rate = rateWithAscent(baseRate);
    const soloBoundary = boss.partyReference
      ? boss.partyLimit === 3
        ? 2.7
        : 5.1
      : 0.9;
    let low = 0,
      high = soloBoundary * 10 + 10;
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      if (rateWithAscent(mid) < soloBoundary) low = mid;
      else high = mid;
    }
    const minimumStat = splineInverse(curve, (high * targetDamage) / boss.rate);
    const entryAllowed = stat.level >= boss.entryLevel;
    const status = entryAllowed
      ? classifyCut(rate, boss.partyReference, boss.partyLimit)
      : "입장 불가능";
    ensure(
      Number.isFinite(rate) && Number.isFinite(effectiveDamage),
      "보스컷 계산값이 유효하지 않아요.",
      422,
    );
    return {
      ...boss,
      minimumStat,
      effectiveStat: splineInverse(curve, effectiveDamage),
      rate,
      status,
      entryAllowed,
      levelPenalty: level < 1.2,
      forcePenalty:
        (boss.arcaneForce > 0 && arcane < (code === "blackMage" ? 1.1 : 1.5)) ||
        (boss.authenticForce > 0 && authentic < 1.25),
    };
  });
  return {
    name,
    world,
    checkedAt: new Date().toISOString(),
    sourceAsOf: data.userApiData.date,
    version: catalogue.version,
    preset: "00000" as const,
    hexa300: c.boss300_hexaStat,
    hexa380: c.boss380_hexaStat,
    cuts,
  };
}
export type BossAnalysis = ReturnType<typeof calculateBossCuts>;
