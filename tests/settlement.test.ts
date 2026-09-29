import { it, expect } from "vitest";
import { emptyLedger } from "@/domain/empty-ledger";
import { applyCommand } from "@/domain/commands";
import { applySoloPolicy } from "@/domain/solo";
import { mergeScheduler } from "@/server/nexon/normalize";
import {
  applyReferencePrices,
  eokToMeso,
  referencePriceSchema,
} from "@/server/catalog/reference-prices";
import { quickDrops } from "@/features/drops/_lib/quickDrops";
function book() {
  const s = emptyLedger();
  s.characters.push({
    id: "test",
    name: "테스트",
    world: "테스트",
    job: "테스트",
    level: 280,
    managed: true,
    favorite: false,
    order: 0,
    avatar: 0,
  });
  mergeScheduler(s, "test", {
    date: "2026-09-29T00:00+09:00",
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
  return s;
}
it("신규 완료는 1인 기준이며 결정석 정산을 중복 생성하지 않는다", () => {
  const s = book(),
    c = s.completions[0];
  expect(c.party).toBe(1);
  expect(c.crystal).toBe("59700000");
  applyCommand(s, { type: "crystal-settle", id: c.id });
  expect(s.settlements[0].net).toBe("59700000");
  expect(() => applyCommand(s, { type: "crystal-settle", id: c.id })).toThrow();
  expect(s.settlements).toHaveLength(1);
});
it("기존 미정산 분배는 1인으로 변경하되 이미 정산한 기록은 보존한다", () => {
  const s = book(),
    c = s.completions[0];
  c.party = 3;
  c.crystal = "10000000";
  expect(applySoloPolicy(s)).toBe(true);
  expect(c.crystal).toBe("30000000");
  expect(applySoloPolicy(s)).toBe(false);
  applyCommand(s, {
    type: "settle",
    targetId: c.id,
    kind: "crystal",
    quantity: 1,
    net: "25000000",
    settledAt: "2026-09-29T00:00:00.000Z",
  });
  c.party = 2;
  c.crystal = "15000000";
  applySoloPolicy(s);
  expect(c.party).toBe(2);
  expect(c.crystal).toBe("15000000");
  expect(s.settlements[0].net).toBe("25000000");
});
it("충돌 또는 가격 미정인 완료는 빠른 정산으로 확정하지 않는다", () => {
  const s = book(),
    c = s.completions[0];
  c.status = "conflict";
  expect(() => applyCommand(s, { type: "crystal-settle", id: c.id })).toThrow();
  c.status = "complete";
  c.crystal = null;
  expect(() => applyCommand(s, { type: "crystal-settle", id: c.id })).toThrow();
  expect(s.settlements).toHaveLength(0);
});
it("억 단위 문자열을 정밀도 손실 없이 메소로 변환한다", () => {
  expect(eokToMeso("0.005")).toBe("500000");
  expect(eokToMeso("3500")).toBe("350000000000");
  expect(eokToMeso("0.00000001")).toBe("1");
  expect(() => eokToMeso("1e8")).toThrow();
  expect(
    referencePriceSchema.safeParse({ success: true, item_price: { x: "-1" } })
      .success,
  ).toBe(false);
});
it("참고가는 새 획득에 적용하고 수동 가격·기존 드랍 스냅샷은 보존한다", () => {
  const s = book(),
    belt = s.items.find((i) => i.name === "몽환의 벨트")!,
    c = s.completions[0];
  expect(belt.price).toBe("3800000000");
  applyCommand(s, {
    type: "drop",
    completionId: c.id,
    itemId: belt.id,
    quantity: 1,
  });
  applyReferencePrices(s, { "몽환의 벨트": "40" }, "2026-10-01T00:00:00.000Z");
  expect(belt.price).toBe("4000000000");
  expect(s.drops[0].unitPrice).toBe("3800000000");
  applyCommand(s, {
    type: "price",
    id: belt.id,
    price: "4200000000",
    market: "내 서버",
    variant: "직접 확인",
  });
  applyReferencePrices(s, { "몽환의 벨트": "50" }, "2026-10-02T00:00:00.000Z");
  expect(belt.price).toBe("4200000000");
});
it("빠른 드랍은 가격 내림차순 최대 5개이며 보스에 없는 후보를 섞지 않는다", () => {
  const s = book(),
    boss = s.bosses[0];
  const items = quickDrops(s, boss);
  expect(items.length).toBeLessThanOrEqual(5);
  expect(items[0].name).toBe("몽환의 벨트");
  expect(items.every((i) => boss.items.includes(i.id))).toBe(true);
  const prices = items
    .filter((i) => i.price !== null)
    .map((i) => BigInt(i.price!));
  expect(
    prices.every((price, index) => index === 0 || prices[index - 1] >= price),
  ).toBe(true);
});
