import { it, expect } from "vitest";
import { completionEntries, summarize } from "@/domain/revenue";
import { validateLedger } from "@/domain/model";
import { emptyLedger } from "@/domain/empty-ledger";
import { applyCommand } from "@/domain/commands";
import { applySoloPolicy } from "@/domain/solo";
import { mergeScheduler } from "@/server/nexon/normalize";
import {
  applyReferencePrices,
  eokToMeso,
  referencePriceSchema,
} from "@/server/catalog/reference-prices";
import { applyAuctionPrices, auctionReportSchema } from "@/server/catalog/auction-prices";
import { quickDrops } from "@/features/drops/_lib/quickDrops";
import { visiblePriceItems } from "@/features/prices/_lib/visiblePriceItems";
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
it("참고가는 새 획득에 적용하고 기존 드랍 스냅샷은 보존한다", () => {
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
  expect(() => applyCommand(s, {
    type: "price",
    id: belt.id,
    price: "4200000000",
    market: "내 서버",
    variant: "직접 확인",
  })).toThrow("아이템 시세는 경매장 수집 결과로만 갱신돼요.");
  belt.price = "4200000000";
  belt.source = "manual";
  applyReferencePrices(s, { "몽환의 벨트": "50" }, "2026-10-02T00:00:00.000Z");
  expect(belt.price).toBe("4200000000");
});
it("경매장 시세는 새 획득 기준가만 바꾸고 기존 드랍은 지킨다", () => {
  const s = book();
  const belt = s.items.find((item) => item.name === "몽환의 벨트")!;
  applyCommand(s, {
    type: "drop",
    completionId: s.completions[0].id,
    itemId: belt.id,
    quantity: 1,
  });
  const originalDropPrice = s.drops[0].unitPrice;
  const observedAt = "2026-10-03T00:00:00.000Z";
  const report = auctionReportSchema.parse({
    source: "https://auction.maplestory.nexon.com/buy",
    world: "베라",
    character: "수민탁구몬함",
    currentWorldOnly: true,
    searchMode: "quick",
    scope: "all",
    sort: "개당 낮은 가격순",
    startedAt: observedAt,
    completedAt: observedAt,
    items: s.items.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.id === belt.id ? "listed" : "zero-results",
      listingCount: item.id === belt.id ? 1 : 0,
      lowestUnitPrice: item.id === belt.id ? "3850000000" : null,
      firstCard: item.id === belt.id ? "몽환의 벨트\n38억 5000만\n메소" : null,
      observedAt,
      searchCounter: 1,
    })),
  });
  const result = applyAuctionPrices(s, report);
  expect(result.updated).toBe(s.items.length);
  expect(result.quoted).toBe(1);
  expect(result.cleared).toBeGreaterThan(0);
  expect(belt.price).toBe("3850000000");
  expect(belt.source).toBe("auction");
  expect(s.items.find((item) => item.id !== belt.id && item.price === null)).toBeDefined();
  expect(s.drops[0].unitPrice).toBe(originalDropPrice);
  applyReferencePrices(s, { "몽환의 벨트": "50" }, "2026-10-04T00:00:00.000Z");
  expect(belt.price).toBe("3850000000");
  belt.source = "manual";
  expect(applyAuctionPrices(s, report).updated).toBe(1);
  expect(belt.source).toBe("auction");
  expect(belt.price).toBe("3850000000");
});
it("빠른 검색의 미정 항목 부분 갱신은 이미 있는 시세를 유지한다", () => {
  const s = book();
  const retained = s.items.find((item) => item.name === "몽환의 벨트")!;
  const target = s.items.find((item) => item.id !== retained.id)!;
  const retainedPrice = retained.price;
  target.price = null;
  const observedAt = "2026-10-03T00:00:00.000Z";
  const report = auctionReportSchema.parse({
    source: "https://auction.maplestory.nexon.com/buy",
    world: "베라",
    character: "수민탁구몬함",
    currentWorldOnly: true,
    searchMode: "quick",
    scope: "missing",
    sort: "개당 낮은 가격순",
    startedAt: observedAt,
    completedAt: observedAt,
    items: [{
      id: target.id,
      name: target.name,
      status: "listed",
      listingCount: 1,
      lowestUnitPrice: "100000000",
      firstCard: `${target.name}\n1억\n메소`,
      observedAt,
      searchCounter: 1,
    }],
  });
  expect(applyAuctionPrices(s, report).updated).toBe(1);
  expect(target.price).toBe("100000000");
  expect(retained.price).toBe(retainedPrice);
});
it("경매장 괄호 앞 공백을 같은 아이템으로 읽고 미정 항목은 시세에서 숨긴다", () => {
  const s = book();
  const hammer = s.items.find((item) => item.name === "몽환의 벨트")!;
  hammer.name = "익셉셔널 해머(벨트)";
  hammer.price = null;
  const unpriced = s.items.find((item) => item.id !== hammer.id)!;
  unpriced.price = null;
  const observedAt = "2026-10-03T00:00:00.000Z";
  const report = auctionReportSchema.parse({
    source: "https://auction.maplestory.nexon.com/buy",
    world: "베라",
    character: "수민탁구몬함",
    currentWorldOnly: true,
    searchMode: "quick",
    scope: "parentheses",
    sort: "개당 낮은 가격순",
    startedAt: observedAt,
    completedAt: observedAt,
    items: [{
      id: hammer.id,
      name: hammer.name,
      query: ` ${hammer.name}`,
      status: "listed",
      listingCount: 4,
      lowestUnitPrice: "7400000000",
      firstCard: "익셉셔널 해머 (벨트)\n개당\n74억\n메소",
      observedAt,
      searchCounter: 95,
    }],
  });
  expect(applyAuctionPrices(s, report).quoted).toBe(1);
  expect(hammer.price).toBe("7400000000");
  expect(visiblePriceItems(s.items, "")).toContain(hammer);
  expect(visiblePriceItems(s.items, "")).not.toContain(unpriced);
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

it("과거 판매 기록이 있어도 드랍 토글과 완료 기준 수익에 영향을 주지 않는다", () => {
  const s = book(),
    c = s.completions[0],
    item = s.items.find((i) => i.name === "몽환의 벨트")!;
  applyCommand(s, {
    type: "drop",
    completionId: c.id,
    itemId: item.id,
    quantity: 1,
  });
  const drop = s.drops[0];
  applyCommand(s, {
    type: "settle",
    kind: "drop",
    targetId: drop.id,
    quantity: 1,
    net: "1",
    settledAt: "2026-09-29T00:00:00.000Z",
  });
  expect(summarize(completionEntries(s)).total).toBe("3859700000");
  applyCommand(s, {
    type: "drop",
    completionId: c.id,
    itemId: item.id,
    quantity: 0,
  });
  expect(() => validateLedger(s)).not.toThrow();
  expect(summarize(completionEntries(s)).total).toBe("59700000");
  expect(s.settlements[0].net).toBe("1");
});
