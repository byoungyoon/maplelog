import { z } from "zod";
import { money, type Ledger } from "@/domain/model";

const timestamp = z.string().datetime();
export const auctionReportSchema = z.object({
  source: z.literal("https://auction.maplestory.nexon.com/buy"),
  world: z.literal("베라"),
  character: z.literal("수민탁구몬함"),
  currentWorldOnly: z.literal(true),
  searchMode: z.literal("quick"),
  scope: z.enum(["all", "missing", "parentheses"]),
  sort: z.literal("개당 낮은 가격순"),
  startedAt: timestamp,
  completedAt: timestamp,
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    query: z.string().optional(),
    status: z.enum(["listed", "zero-results", "optioned", "no-exact-first-page"]),
    listingCount: z.number().int().nonnegative(),
    lowestUnitPrice: money.nullable(),
    firstCard: z.string().nullable(),
    observedAt: timestamp,
    searchCounter: z.number().int().min(0).max(100),
  })).max(1000),
});

export type AuctionReport = z.infer<typeof auctionReportSchema>;

export function applyAuctionPrices(book: Ledger, report: AuctionReport) {
  const byId = new Map(book.items.map((item) => [item.id, item]));
  if (report.scope === "all" && (
    report.items.length !== book.items.length ||
    report.items.some((entry, index) =>
      entry.id !== book.items[index].id || entry.name !== book.items[index].name
    )
  )) throw new Error("수집 결과와 현재 시세 항목이 일치하지 않습니다.");
  if (
    new Set(report.items.map((entry) => entry.id)).size !== report.items.length ||
    report.items.some((entry) => {
      const item = byId.get(entry.id);
      return !item || item.name !== entry.name ||
        (report.scope !== "all" && item.price !== null) ||
        (report.scope === "parentheses" && !item.name.includes("("));
    })
  ) throw new Error("수집 결과의 항목이 현재 장부와 일치하지 않습니다.");

  const result = {
    updated: 0,
    quoted: 0,
    noQuote: 0,
    optioned: 0,
    cleared: 0,
  };
  for (const entry of report.items) {
    const item = byId.get(entry.id)!;
    if (
      (entry.status === "zero-results") !== (entry.listingCount === 0) ||
      (entry.status !== "listed" && entry.lowestUnitPrice !== null)
    ) throw new Error(`${entry.name}: 검색 상태와 가격이 일치하지 않습니다.`);
    let price: string | null = null;
    let variant = "현재 월드 · 매물 없음";
    if (entry.status === "listed") {
      if (
        entry.listingCount < 1 ||
        !entry.lowestUnitPrice ||
        entry.lowestUnitPrice === "0" ||
        !entry.firstCard?.split("\n").some((line) =>
          line.trim().replace(/\s+\(/g, "(") === entry.name
        )
      ) throw new Error(`${entry.name}: 최저 적합 매물 정보가 불완전합니다.`);
      price = entry.lowestUnitPrice;
      variant = "현재 월드 · 빠른 검색 개당 최저 적합 등록가 · 옵션 미검증";
      result.quoted++;
    } else {
      result.noQuote++;
      if (entry.status === "optioned") {
        variant = "현재 월드 · 첫 페이지 매물 옵션 확인 필요";
        result.optioned++;
      }
      if (entry.status === "no-exact-first-page")
        variant = "현재 월드 · 첫 페이지에 동일 아이템 없음";
    }
    const market = "베라 경매장";
    if (
      item.price === price &&
      item.source === "auction" &&
      item.observedAt === entry.observedAt &&
      item.market === market &&
      item.variant === variant
    ) continue;
    if (item.price !== null && price === null) result.cleared++;
    item.price = price;
    item.source = "auction";
    item.observedAt = entry.observedAt;
    item.market = market;
    item.variant = variant;
    result.updated++;
  }
  return result;
}
