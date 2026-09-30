import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { applyAuctionPrices, auctionReportSchema } from "@/server/catalog/auction-prices";
import { editBook, readBook } from "@/server/db";

process.loadEnvFile(".env");
const reportPath = path.resolve(process.argv[2] || "data/auction-quick-all-latest.json");
const report = auctionReportSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")));
const finished = Date.parse(report.completedAt);
if (finished > Date.now() + 300000 || Date.now() - finished > 21600000)
  throw new Error("수집 결과가 6시간 이내에 완료되지 않았습니다.");

const current = await readBook("live");
const preview = structuredClone(current);
const counts = applyAuctionPrices(preview, report);
if (counts.updated === 0) {
  console.log(JSON.stringify({ ...counts, applied: false }));
} else {
  mkdirSync("data", { recursive: true, mode: 0o700 });
  const backup = path.resolve(
    `data/mesolog-before-auction-${new Date().toISOString().replaceAll(":", "-")}.json`,
  );
  writeFileSync(backup, JSON.stringify(current), { mode: 0o600 });
  const result = await editBook((book) => {
    const changed = applyAuctionPrices(book, report);
    book.audit.unshift({
      id: randomUUID(),
      at: new Date().toISOString(),
      title: "경매장 시세 반영",
      detail: `베라 빠른 검색 · ${changed.updated}개 갱신 · ${changed.quoted}개 가격 확인 · ${changed.noQuote}개 가격 미정 · ${changed.optioned}개 옵션 확인 필요`,
      targetId: "auction:vera",
    });
    book.audit = book.audit.slice(0, 1000);
    return changed;
  });
  console.log(JSON.stringify({ ...result, applied: true, backup }));
}
