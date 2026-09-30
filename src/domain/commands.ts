import { z } from "zod";
import { ensure, money, type Ledger, type Completion } from "./model";
import { periodAt } from "./period";
const id = z.string().min(1).max(200);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prices-refresh") }),
  z.object({
    type: z.literal("item-create"),
    bossId: id,
    name: z.string().trim().min(1).max(100),
    price: money.nullable(),
    tradable: z.boolean(),
    market: z.string().trim().min(1).max(80),
    variant: z.string().max(160),
  }),
  z.object({
    type: z.literal("crystal-price"),
    bossId: id,
    price: money.nullable(),
  }),
  z.object({ type: z.literal("complete"), planId: id }),
  z.object({ type: z.literal("crystal-settle"), id }),
  z.object({
    type: z.literal("completion-confirm"),
    id,
    party: z.number().int().min(1).max(6),
    difficulty: z.string().min(1).max(30),
  }),
  z.object({
    type: z.literal("prices-import"),
    quotes: z
      .array(
        z.object({
          id,
          price: money.nullable(),
          market: z.string().min(1).max(80),
          variant: z.string().max(160),
        }),
      )
      .min(1)
      .max(1000),
  }),
  z.object({
    type: z.literal("drop"),
    completionId: id,
    itemId: id,
    quantity: z.number().int().min(0).max(9999),
  }),
  z.object({
    type: z.literal("drop-edit"),
    id,
    tradable: z.boolean(),
    shared: z.boolean(),
    share: z.number().int().min(1).max(6).nullable(),
    feeBps: z.number().int().min(0).max(10000),
    cost: money,
    used: z.number().int().min(0).max(9999),
    note: z.string().max(1000),
  }),
  z.object({
    type: z.literal("review"),
    id,
    value: z.enum(["pending", "recorded", "none"]),
    confirm: z.boolean().optional(),
  }),
  z.object({ type: z.literal("exclude"), id, value: z.boolean() }),
  z.object({
    type: z.literal("settle"),
    targetId: id,
    kind: z.enum(["drop", "crystal"]),
    quantity: z.number().int().min(1).max(9999),
    net: money,
    settledAt: z.string().datetime(),
    settlementId: id.optional(),
  }),
  z.object({ type: z.literal("cancel-settlement"), id }),
  z.object({
    type: z.literal("price"),
    id,
    price: money.nullable(),
    market: z.string().min(1).max(80),
    variant: z.string().max(160),
  }),
  z.object({ type: z.literal("revalue"), id }),
  z.object({
    type: z.literal("character"),
    id,
    managed: z.boolean(),
    favorite: z.boolean(),
    order: z.number().int().min(0).max(99),
  }),
  z.object({
    type: z.literal("plan"),
    id,
    enabled: z.boolean(),
    party: z.number().int().min(1).max(6).nullable(),
    difficulty: z.string().min(1).max(30).nullable(),
  }),
  z.object({ type: z.literal("setup") }),
  z.object({
    type: z.literal("settings"),
    dailyBudget: z.number().int().min(1).max(800),
    staleHours: z.number().int().min(1).max(720),
  }),
  z.object({ type: z.literal("focus"), characterId: id.nullable() }),
  z.object({
    type: z.literal("sync"),
    scenario: z.enum([
      "refresh",
      "complete",
      "replay",
      "error",
      "boundary",
      "price-error",
      "rate-limit",
      "regress",
    ]),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export function audit(
  s: Ledger,
  title: string,
  detail: string,
  targetId = "system",
  at = new Date().toISOString(),
) {
  s.audit.unshift({
    id: crypto.randomUUID(),
    at,
    title,
    detail: detail.slice(0, 300),
    targetId,
  });
  s.audit = s.audit.slice(0, 1000);
}
export function observe(
  s: Ledger,
  planId: string,
  asOf: string,
  complete = true,
  initial = false,
  manual = false,
): Completion | undefined {
  const p = s.plans.find((p) => p.id === planId);
  ensure(p, "보스 계획을 찾을 수 없어요.");
  const b = s.bosses.find((b) => b.id === p.bossId)!;
  const period = periodAt(asOf, b.cycle);
  let c = s.completions.find(
    (c) =>
      c.characterId === p.characterId &&
      c.group === b.group &&
      c.periodStart === period.start,
  );
  if (c) {
    if (asOf < c.sourceAsOf) return c;
    if (!complete) {
      if (c.status !== "conflict")
        audit(s, "완료 정보 확인 필요", "기존 기록을 유지했어요.", c.id);
      c.status = "conflict";
      c.sourceAsOf = asOf;
    } else {
      c.sourceAsOf = asOf;
      if (!manual && c.provenance === "manual")
        audit(
          s,
          "완료 기록 연결",
          "기존 수동 기록에 조회 결과를 연결했어요.",
          c.id,
        );
    }
    return c;
  }
  if (!complete) return;
  c = {
    id: crypto.randomUUID(),
    characterId: p.characterId,
    bossId: b.id,
    group: b.group,
    cycle: b.cycle,
    periodStart: period.start,
    periodEnd: period.end,
    detectedAt: asOf,
    sourceAsOf: asOf,
    occurredAt: null,
    provenance: initial
      ? "initial"
      : manual
        ? "manual"
        : s.mode === "demo"
          ? "demo"
          : "api",
    status: "complete",
    difficulty: p.difficulty,
    party: s.mode === "live" ? 1 : p.party,
    crystal:
      p.difficulty && b.crystal && (s.mode === "live" || p.party)
        ? (
            BigInt(b.crystal) / BigInt(s.mode === "live" ? 1 : p.party!)
          ).toString()
        : null,
    review: "pending",
    excluded: false,
    ruleVersion: b.ruleVersion,
  };
  s.completions.push(c);
  if (!initial)
    audit(
      s,
      manual ? "수동 완료 기록" : "완료 감지",
      `${s.characters.find((x) => x.id === p.characterId)!.name} · ${b.name}`,
      c.id,
      asOf,
    );
  return c;
}
export function applyCommand(
  s: Ledger,
  cmd: Command,
  now = new Date().toISOString(),
): void {
  switch (cmd.type) {
    case "item-create": {
      const boss = s.bosses.find((b) => b.id === cmd.bossId);
      ensure(boss, "보스를 찾을 수 없어요.");
      const existing = s.items.find(
        (i) =>
          i.name === cmd.name &&
          i.market === cmd.market &&
          i.variant === cmd.variant &&
          i.tradable === cmd.tradable,
      );
      const item = existing ?? {
        id: crypto.randomUUID(),
        name: cmd.name,
        icon: "gem" as const,
        tradable: cmd.tradable,
        tradeConfirmed: true,
        price: cmd.price,
        source: "manual" as const,
        observedAt: now,
        market: cmd.market,
        variant: cmd.variant,
      };
      if (!existing) s.items.push(item);
      if (!boss.items.includes(item.id)) boss.items.push(item.id);
      audit(
        s,
        "드랍 후보 직접 등록",
        `${boss.name} · ${item.name}`,
        boss.id,
        now,
      );
      break;
    }
    case "crystal-price": {
      const boss = s.bosses.find((b) => b.id === cmd.bossId);
      ensure(boss, "보스를 찾을 수 없어요.");
      boss.crystal = cmd.price;
      boss.crystalSource = "manual";
      audit(
        s,
        "결정석 기준가 수정",
        `${boss.name} ${boss.difficulty} · 사용자 입력`,
        boss.id,
        now,
      );
      break;
    }
    case "prices-import": {
      for (const quote of cmd.quotes)
        applyCommand(s, { type: "price", ...quote }, now);
      break;
    }
    case "completion-confirm": {
      const c = s.completions.find((c) => c.id === cmd.id);
      ensure(c, "완료 기록이 없어요.");
      const b = s.bosses.find((b) => b.id === c.bossId)!;
      ensure(cmd.difficulty === b.difficulty, "검증된 난이도에 맞춰 주세요.");
      ensure(
        !s.settlements.some(
          (x) => !x.deleted && x.kind === "crystal" && x.targetId === c.id,
        ),
        "결정석 정산을 먼저 취소해 주세요.",
      );
      c.party = s.mode === "live" ? 1 : cmd.party;
      c.difficulty = cmd.difficulty;
      c.status = "complete";
      c.crystal = b.crystal
        ? (BigInt(b.crystal) / BigInt(c.party)).toString()
        : null;
      audit(
        s,
        "완료 조건 확인",
        `${cmd.difficulty} · 사용자 설정 ${c.party}인 분배`,
        c.id,
        now,
      );
      break;
    }
    case "crystal-settle": {
      const c = s.completions.find((c) => c.id === cmd.id);
      ensure(c && !c.excluded, "정산할 완료 기록을 찾을 수 없어요.");
      ensure(
        c.status === "complete" && c.difficulty,
        "보스 완료 정보를 먼저 확인해 주세요.",
      );
      const boss = s.bosses.find((b) => b.id === c.bossId)!;
      const crystal =
        c.party === 1
          ? c.crystal
          : c.crystal && c.party
            ? (BigInt(c.crystal) * BigInt(c.party)).toString()
            : boss.crystal;
      ensure(crystal !== null, "결정석 기준 가격을 먼저 입력해 주세요.");
      c.party = 1;
      c.crystal = crystal;
      applyCommand(
        s,
        {
          type: "settle",
          kind: "crystal",
          targetId: c.id,
          quantity: 1,
          net: crystal,
          settledAt: now,
        },
        now,
      );
      break;
    }
    case "complete":
      observe(s, cmd.planId, now, true, false, true);
      break;
    case "drop": {
      const c = s.completions.find((c) => c.id === cmd.completionId);
      ensure(c, "완료 기록을 찾을 수 없어요.");
      ensure(!c.excluded, "제외한 완료 기록이에요.");
      const b = s.bosses.find((b) => b.id === c.bossId)!;
      ensure(b.items.includes(cmd.itemId), "이 보스의 드랍 후보가 아니에요.");
      const item = s.items.find((i) => i.id === cmd.itemId)!;
      let d = s.drops.find(
        (d) => d.completionId === c.id && d.itemId === item.id,
      );
      if (!d) {
        d = {
          id: crypto.randomUUID(),
          completionId: c.id,
          itemId: item.id,
          quantity: 0,
          used: 0,
          unitPrice: item.price,
          priceSource: item.source,
          observedAt: item.observedAt,
          market: item.market,
          variant: item.variant,
          tradable: item.tradable,
          tradeConfirmed: item.tradeConfirmed,
          shared: false,
          share: 1,
          feeBps: 0,
          cost: "0",
          note: "",
        };
        s.drops.push(d);
      }
      const settled = (s.mode === "live" ? [] : s.settlements)
        .filter((x) => !x.deleted && x.targetId === d.id && x.kind === "drop")
        .reduce((a, x) => a + x.quantity, 0);
      ensure(
        cmd.quantity >= settled + d.used,
        s.mode === "live"
          ? "사용 수량을 먼저 수정해 주세요."
          : "정산·사용한 수량은 먼저 취소해 주세요.",
      );
      d.quantity = cmd.quantity;
      c.review = s.drops.some((d) => d.completionId === c.id && d.quantity > 0)
        ? "recorded"
        : "pending";
      audit(s, "드랍 기록", `${item.name} ${cmd.quantity}개`, c.id, now);
      break;
    }
    case "drop-edit": {
      const d = s.drops.find((d) => d.id === cmd.id);
      ensure(d, "획득 기록이 없어요.");
      Object.assign(d, {
        tradable: cmd.tradable,
        tradeConfirmed: true,
        shared: s.mode === "live" ? false : cmd.shared,
        share: s.mode === "live" ? 1 : cmd.share,
        feeBps: cmd.feeBps,
        cost: cmd.cost,
        used: cmd.used,
        note: cmd.note,
      });
      audit(
        s,
        "드랍 상세 수정",
        d.note || "분배·비용·사용 수량 변경",
        d.completionId,
        now,
      );
      break;
    }
    case "review": {
      const c = s.completions.find((c) => c.id === cmd.id);
      ensure(c, "완료 기록이 없어요.");
      const ds = s.drops.filter(
        (d) => d.completionId === c.id && d.quantity > 0,
      );
      if (cmd.value === "none" && ds.length) {
        ensure(cmd.confirm, "선택한 아이템 삭제 확인이 필요해요.");
        ensure(
          !ds.some(
            (d) =>
              d.used > 0 ||
              (s.mode !== "live" &&
                s.settlements.some(
                  (x) => !x.deleted && x.kind === "drop" && x.targetId === d.id,
                )),
          ),
          s.mode === "live"
            ? "사용 수량을 먼저 수정해 주세요."
            : "정산·사용한 획득 기록은 지울 수 없어요.",
        );
        ds.forEach((d) => (d.quantity = 0));
      }
      if (cmd.value === "recorded")
        ensure(ds.length > 0, "선택한 아이템이 없어요.");
      c.review = cmd.value;
      audit(
        s,
        "드랍 확인",
        cmd.value === "none" ? "없음으로 확인" : "확인 상태 변경",
        c.id,
        now,
      );
      break;
    }
    case "exclude": {
      const c = s.completions.find((c) => c.id === cmd.id);
      ensure(c, "완료 기록이 없어요.");
      c.excluded = cmd.value;
      audit(
        s,
        cmd.value ? "기록 제외" : "기록 복원",
        "예상 합계 반영 상태 변경",
        c.id,
        now,
      );
      break;
    }
    case "settle": {
      const target =
        cmd.kind === "drop"
          ? s.drops.find((d) => d.id === cmd.targetId)
          : s.completions.find((c) => c.id === cmd.targetId);
      ensure(target, "정산 대상이 없어요.");
      const old = cmd.settlementId
        ? s.settlements.find((x) => x.id === cmd.settlementId && !x.deleted)
        : undefined;
      if (cmd.settlementId)
        ensure(
          old && old.targetId === cmd.targetId && old.kind === cmd.kind,
          "정산 수정 대상이 잘못되었어요.",
        );
      const used = s.settlements
        .filter(
          (x) =>
            !x.deleted &&
            x.id !== old?.id &&
            x.targetId === cmd.targetId &&
            x.kind === cmd.kind,
        )
        .reduce((a, x) => a + x.quantity, 0);
      const available =
        cmd.kind === "drop" && "quantity" in target
          ? target.quantity - target.used
          : 1;
      ensure(used + cmd.quantity <= available, "미정산 수량보다 많아요.");
      if (old)
        Object.assign(old, {
          quantity: cmd.quantity,
          net: cmd.net,
          settledAt: cmd.settledAt,
        });
      else
        s.settlements.push({
          id: crypto.randomUUID(),
          targetId: cmd.targetId,
          kind: cmd.kind,
          quantity: cmd.quantity,
          net: cmd.net,
          settledAt: cmd.settledAt,
          deleted: false,
        });
      audit(
        s,
        old ? "정산 수정" : "정산 완료",
        `순수령 ${cmd.net} 메소 · ${cmd.quantity}개`,
        cmd.targetId,
        now,
      );
      break;
    }
    case "cancel-settlement": {
      const x = s.settlements.find((x) => x.id === cmd.id);
      ensure(x, "정산이 없어요.");
      x.deleted = true;
      audit(s, "정산 취소", "미정산 수량과 예상액 복원", x.targetId, now);
      break;
    }
    case "price": {
      const i = s.items.find((i) => i.id === cmd.id);
      ensure(i, "아이템이 없어요.");
      i.price = cmd.price;
      i.source = "manual";
      i.market = cmd.market;
      i.variant = cmd.variant;
      i.observedAt = now;
      audit(s, "기준가 수정", i.name, i.id, now);
      break;
    }
    case "revalue": {
      const d = s.drops.find((d) => d.id === cmd.id);
      ensure(d, "획득 기록이 없어요.");
      const i = s.items.find((i) => i.id === d.itemId)!;
      ensure(
        d.market === i.market && d.variant === i.variant,
        "시장·옵션 조건이 달라 재평가할 수 없어요.",
      );
      audit(
        s,
        "명시적 재평가",
        `이전 ${d.currentQuote?.unitPrice ?? d.unitPrice ?? "미정"} → ${i.price ?? "미정"}`,
        d.id,
        now,
      );
      d.currentQuote = {
        unitPrice: i.price,
        priceSource: i.source,
        observedAt: i.observedAt,
      };
      break;
    }
    case "character": {
      const c = s.characters.find((c) => c.id === cmd.id);
      ensure(c, "캐릭터가 없어요.");
      c.managed = cmd.managed;
      c.favorite = cmd.favorite;
      c.order = cmd.order;
      break;
    }
    case "plan": {
      const p = s.plans.find((p) => p.id === cmd.id);
      ensure(p, "계획이 없어요.");
      p.enabled = cmd.enabled;
      p.party = s.mode === "live" ? 1 : cmd.party;
      if (cmd.difficulty) {
        const boss = s.bosses.find((b) => b.id === p.bossId)!;
        const variant = s.bosses.find(
          (b) => b.group === boss.group && b.difficulty === cmd.difficulty,
        );
        ensure(variant, "조회된 보스 난이도를 선택해 주세요.");
        p.bossId = variant.id;
      }
      p.difficulty = cmd.difficulty;
      break;
    }
    case "setup":
      ensure(
        s.characters.some((c) => c.managed),
        "관리할 캐릭터를 선택해 주세요.",
      );
      s.settings.setupDone = true;
      break;
    case "settings":
      s.settings.dailyBudget = cmd.dailyBudget;
      s.settings.staleHours = cmd.staleHours;
      break;
    case "focus":
      ensure(
        cmd.characterId === null ||
          s.characters.some((c) => c.id === cmd.characterId && c.managed),
        "관리 캐릭터를 선택해 주세요.",
      );
      s.sync.focusCharacter = cmd.characterId;
      s.sync.focusUntil = cmd.characterId
        ? new Date(new Date(now).getTime() + 7200000).toISOString()
        : null;
      break;
    case "sync": {
      ensure(
        s.mode === "demo",
        "공식 응답 스키마 검증 전에는 실제 동기화를 사용할 수 없어요.",
        501,
      );
      if (
        cmd.scenario === "error" ||
        cmd.scenario === "rate-limit" ||
        cmd.scenario === "price-error"
      ) {
        s.sync.error =
          cmd.scenario === "rate-limit"
            ? "호출 예산을 모두 사용했어요. 다음 예산까지 조회를 중단해요."
            : cmd.scenario === "price-error"
              ? "가격 조회 실패 · 마지막 기준가는 유지했어요."
              : "외부 API 오류 · 기존 정상 기록은 유지했어요.";
        break;
      }
      s.sync.error = null;
      s.sync.lastSuccess = now;
      const p = s.plans.find(
        (p) =>
          p.enabled &&
          !s.completions.some(
            (c) =>
              c.characterId === p.characterId &&
              c.bossId === p.bossId &&
              c.periodStart ===
                periodAt(now, s.bosses.find((b) => b.id === p.bossId)!.cycle)
                  .start,
          ),
      );
      if (cmd.scenario === "complete" && p) observe(s, p.id, now);
      if (cmd.scenario === "replay" || cmd.scenario === "regress") {
        const c = s.completions[0];
        const p = s.plans.find(
          (p) => p.characterId === c?.characterId && p.bossId === c?.bossId,
        );
        if (c && p) observe(s, p.id, c.sourceAsOf, cmd.scenario !== "regress");
      }
      if (cmd.scenario === "boundary") {
        const p = s.plans.find((p) => p.enabled)!;
        const b = s.bosses.find((b) => b.id === p.bossId)!;
        const at = periodAt(now, b.cycle).start;
        observe(s, p.id, new Date(new Date(at).getTime() - 1).toISOString());
        observe(s, p.id, at);
      }
      break;
    }
  }
}
