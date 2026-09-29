import { it, expect } from "vitest";
import { existsSync } from "node:fs";
import { applyCatalogue, catalogCrystal, catalogBoss } from "@/server/catalog";
import { emptyLedger } from "@/domain/empty-ledger";
import { applyCommand } from "@/domain/commands";
import catalog from "@/data/scouter-catalog.json";
it("결정석 가격표는 9월 17일과 검은 마법사 10월 1일 적용 시점을 구분한다", () => {
  expect(catalogCrystal("루시드", "하드", "2026-09-16T08:00:00.000Z")).toBe(
    "62900000",
  );
  expect(catalogCrystal("루시드", "하드", "2026-09-29T08:00:00.000Z")).toBe(
    "59700000",
  );
  expect(
    catalogCrystal("검은 마법사", "하드", "2026-09-30T14:59:59.000Z"),
  ).toBe("665000000");
  expect(
    catalogCrystal("검은 마법사", "하드", "2026-09-30T15:00:00.000Z"),
  ).toBe("465000000");
});
it("가격·이미지 갱신을 반복해도 사용자 기준가를 덮거나 후보를 중복 추가하지 않는다", () => {
  const b = emptyLedger();
  b.bosses = [
    {
      id: "lucid",
      group: "lucid",
      name: "루시드",
      difficulty: "하드",
      cycle: "weekly",
      crystal: null,
      items: [],
      icon: "flower",
      ruleVersion: "nexon-observed-v1",
    },
  ];
  applyCatalogue(b);
  const count = b.items.length;
  expect(count).toBeGreaterThan(0);
  expect(b.bosses[0].crystal).toBe("59700000");
  applyCommand(b, {
    type: "crystal-price",
    bossId: "lucid",
    price: "123456789",
  });
  applyCatalogue(b);
  expect(b.bosses[0].crystal).toBe("123456789");
  expect(b.items).toHaveLength(count);
  expect(
    b.items.every((i) => i.price === null && i.tradeConfirmed === false),
  ).toBe(true);
});
it("원본에 없는 이미지는 null로 표시하며 참조한 로컬 파일은 모두 존재한다", () => {
  for (const entry of [...catalog.bosses, ...catalog.items])
    if (entry.image)
      expect(existsSync("public" + entry.image), entry.image).toBe(true);
  expect(catalogBoss("시즌 보스 메이린", "노멀")).toBeDefined();
});
