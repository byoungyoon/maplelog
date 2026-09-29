import { z } from "zod";
export const money = z.string().regex(/^(0|[1-9]\d{0,39})$/);
const id = z.string().min(1).max(200);
const stamp = z.string().datetime();
export const cycleSchema = z.enum(["weekly", "daily", "monthly"]);
export type Cycle = z.infer<typeof cycleSchema>;
export const characterSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  world: z.string().max(60),
  job: z.string().max(60),
  level: z.number().int().min(1).max(400),
  managed: z.boolean(),
  favorite: z.boolean(),
  order: z.number().int().min(0),
  image: z.string().url().nullable().optional(),
  imageUpdatedAt: stamp.optional(),
  avatar: z.number().int().min(0).max(2),
});
export const bossSchema = z.object({
  image: z.string().startsWith("/catalog/").nullable().optional(),
  crystalSource: z.enum(["manual", "scouter"]).optional(),
  crystalCheckedAt: z.string().optional(),
  id,
  name: z.string().max(80),
  group: id,
  cycle: cycleSchema,
  difficulty: z.string().max(30),
  crystal: money.nullable(),
  items: z.array(id).max(30),
  icon: z.enum(["moon", "flower", "shield", "flame", "crown", "snow"]),
  ruleVersion: z.enum(["demo-v1", "nexon-observed-v1"]),
});
export const itemSchema = z.object({
  image: z.string().startsWith("/catalog/").nullable().optional(),
  tradeConfirmed: z.boolean().optional(),
  id,
  name: z.string().max(100),
  icon: z.enum(["gem", "ring", "box", "scroll", "flower"]),
  tradable: z.boolean(),
  price: money.nullable(),
  source: z.enum(["demo", "manual", "scouter"]),
  observedAt: stamp,
  market: z.string().max(80),
  variant: z.string().max(160),
});
export const planSchema = z.object({
  id,
  characterId: id,
  bossId: id,
  enabled: z.boolean(),
  party: z.number().int().min(1).max(6).nullable(),
  difficulty: z.string().max(30).nullable(),
});
export const completionSchema = z.object({
  party: z.number().int().min(1).max(6).nullable().optional(),
  id,
  characterId: id,
  bossId: id,
  group: id,
  cycle: cycleSchema,
  periodStart: stamp,
  periodEnd: stamp,
  detectedAt: stamp,
  occurredAt: stamp.nullable(),
  sourceAsOf: stamp,
  provenance: z.enum(["initial", "manual", "api", "demo"]),
  status: z.enum(["complete", "conflict"]),
  difficulty: z.string().max(30).nullable(),
  crystal: money.nullable(),
  review: z.enum(["pending", "recorded", "none", "excluded"]),
  excluded: z.boolean(),
  ruleVersion: z.enum(["demo-v1", "nexon-observed-v1"]),
});
export const dropSchema = z.object({
  tradeConfirmed: z.boolean().optional(),
  currentQuote: z
    .object({
      unitPrice: money.nullable(),
      priceSource: z.enum(["demo", "manual", "scouter"]),
      observedAt: stamp,
    })
    .optional(),
  id,
  completionId: id,
  itemId: id,
  quantity: z.number().int().min(0).max(9999),
  used: z.number().int().min(0).max(9999),
  unitPrice: money.nullable(),
  priceSource: z.enum(["demo", "manual", "scouter"]),
  observedAt: stamp,
  market: z.string().max(80),
  variant: z.string().max(160),
  tradable: z.boolean(),
  shared: z.boolean(),
  share: z.number().int().min(1).max(6).nullable(),
  feeBps: z.number().int().min(0).max(10000),
  cost: money,
  note: z.string().max(1000),
});
export const settlementSchema = z.object({
  id,
  targetId: id,
  kind: z.enum(["crystal", "drop"]),
  quantity: z.number().int().min(1).max(9999),
  net: money,
  settledAt: stamp,
  deleted: z.boolean(),
});
export const auditSchema = z.object({
  id,
  at: stamp,
  title: z.string().max(120),
  detail: z.string().max(300),
  targetId: id,
});
export const ledgerSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(["demo", "live"]),
  revision: z.number().int().min(0),
  characters: z.array(characterSchema).max(100),
  bosses: z.array(bossSchema).max(200),
  items: z.array(itemSchema).max(1000),
  plans: z.array(planSchema).max(5000),
  completions: z.array(completionSchema).max(30000),
  drops: z.array(dropSchema).max(30000),
  settlements: z.array(settlementSchema).max(50000),
  audit: z.array(auditSchema).max(1000),
  sync: z.object({
    characters: z
      .array(
        z.object({
          characterId: id,
          checkedAt: stamp,
          sourceAsOf: stamp.nullable(),
          status: z.enum(["ok", "empty", "error", "unsupported"]),
          message: z.string().max(300).nullable(),
          bossCount: z.number().int(),
          weeklyClearCount: z.number().int(),
          weeklyClearLimit: z.number().int(),
        }),
      )
      .optional(),
    lastSuccess: stamp.nullable(),
    error: z.string().max(300).nullable(),
    focusCharacter: id.nullable(),
    focusUntil: stamp.nullable(),
    lastRequest: stamp.nullable(),
    workerSeen: stamp.nullable(),
  }),
  settings: z.object({
    setupDone: z.boolean(),
    dailyBudget: z.number().int().min(1).max(800),
    staleHours: z.number().int().min(1).max(720),
  }),
});
export type Ledger = z.infer<typeof ledgerSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Boss = z.infer<typeof bossSchema>;
export type Completion = z.infer<typeof completionSchema>;
export type Drop = z.infer<typeof dropSchema>;
export type Settlement = z.infer<typeof settlementSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Mode = Ledger["mode"];
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function ensure(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new DomainError(message, status);
}
export function validateLedger(input: unknown): Ledger {
  const s = ledgerSchema.parse(input);
  if (s.mode === "live")
    ensure(
      s.bosses.every((b) => b.ruleVersion !== "demo-v1") &&
        s.items.every((i) => i.source !== "demo") &&
        s.completions.every((c) => c.provenance !== "demo"),
      "데모 규칙과 아이템을 실제 장부로 복원할 수 없어요.",
    );
  ensure(
    new Set(s.plans.map((p) => `${p.characterId}/${p.bossId}`)).size ===
      s.plans.length,
    "중복 보스 계획이 있어요.",
  );
  for (const list of [
    s.characters,
    s.bosses,
    s.items,
    s.plans,
    s.completions,
    s.drops,
    s.settlements,
  ])
    ensure(
      new Set(list.map((x) => x.id)).size === list.length,
      "중복 식별자가 있어요.",
    );
  const has = (list: { id: string }[], v: string) =>
    list.some((x) => x.id === v);
  s.bosses.forEach((b) =>
    b.items.forEach((i) =>
      ensure(has(s.items, i), "아이템 참조가 잘못되었어요."),
    ),
  );
  s.plans.forEach((p) =>
    ensure(
      has(s.characters, p.characterId) && has(s.bosses, p.bossId),
      "계획 참조가 잘못되었어요.",
    ),
  );
  const keys = new Set<string>();
  s.completions.forEach((c) => {
    ensure(
      has(s.characters, c.characterId) && has(s.bosses, c.bossId),
      "완료 참조가 잘못되었어요.",
    );
    const boss = s.bosses.find((b) => b.id === c.bossId)!;
    ensure(
      c.group === boss.group &&
        c.cycle === boss.cycle &&
        c.ruleVersion === boss.ruleVersion,
      "완료와 보스 규칙이 일치하지 않아요.",
    );
    ensure(c.periodStart < c.periodEnd, "주기가 잘못되었어요.");
    const k = `${c.characterId}/${c.group}/${c.periodStart}`;
    ensure(!keys.has(k), "중복 완료가 있어요.");
    keys.add(k);
  });
  const dk = new Set<string>();
  s.drops.forEach((d) => {
    const c = s.completions.find((c) => c.id === d.completionId);
    ensure(c && has(s.items, d.itemId), "획득 참조가 잘못되었어요.");
    ensure(
      s.bosses.find((b) => b.id === c.bossId)?.items.includes(d.itemId),
      "보스 드랍 후보가 아니에요.",
    );
    const k = `${d.completionId}/${d.itemId}`;
    ensure(!dk.has(k), "중복 획득이 있어요.");
    dk.add(k);
  });
  s.settlements.forEach((x) =>
    ensure(
      has(x.kind === "drop" ? s.drops : s.completions, x.targetId),
      "정산 참조가 잘못되었어요.",
    ),
  );
  s.drops.forEach((d) =>
    ensure(
      d.used +
        s.settlements
          .filter((x) => !x.deleted && x.kind === "drop" && x.targetId === d.id)
          .reduce((a, x) => a + x.quantity, 0) <=
        d.quantity,
      "정산·사용 수량이 획득 수량보다 많아요.",
    ),
  );
  s.completions.forEach((c) =>
    ensure(
      s.settlements
        .filter(
          (x) => !x.deleted && x.kind === "crystal" && x.targetId === c.id,
        )
        .reduce((a, x) => a + x.quantity, 0) <= 1,
      "결정석이 중복 정산되었어요.",
    ),
  );
  return s;
}
