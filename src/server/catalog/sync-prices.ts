import { readBook, sqlite, writeBook } from "@/server/db";
import {
  applyReferencePrices,
  referencePriceSchema,
  referencePriceURL,
} from "./reference-prices";
export async function syncReferencePrices({
  force = false,
  fetcher = fetch,
}: { force?: boolean; fetcher?: typeof fetch } = {}) {
  const lease = "scouter-reference-prices";
  const now = Date.now();
  const acquired = sqlite
    .transaction(() => {
      const prior = sqlite
        .prepare("SELECT until_at FROM leases WHERE name=?")
        .get(lease) as { until_at: number } | undefined;
      if (prior && prior.until_at > now) return false;
      const status = readBook("live").priceSync;
      if (
        !force &&
        status?.checkedAt &&
        now - Date.parse(status.checkedAt) < 86400000
      )
        return false;
      sqlite
        .prepare(
          "INSERT INTO leases(name,until_at) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET until_at=excluded.until_at",
        )
        .run(lease, now + 30000);
      return true;
    })
    .immediate();
  if (!acquired) return { coalesced: true };
  try {
    const response = await fetcher(referencePriceURL, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error("메이플스카우터 가격을 가져오지 못했어요.");
    const payload = referencePriceSchema.parse(await response.json());
    const checkedAt = new Date().toISOString();
    sqlite
      .transaction(() => {
        const book = readBook("live");
        applyReferencePrices(book, payload.item_price, checkedAt);
        book.priceSync = { checkedAt, error: null };
        book.revision++;
        writeBook(book);
      })
      .immediate();
    return { checkedAt, count: Object.keys(payload.item_price).length };
  } catch {
    sqlite
      .transaction(() => {
        const book = readBook("live");
        book.priceSync = {
          checkedAt: book.priceSync?.checkedAt ?? null,
          error: "가격 조회에 실패했어요. 마지막 참고가를 유지해요.",
        };
        book.revision++;
        writeBook(book);
      })
      .immediate();
    throw new Error("가격 조회에 실패했어요. 마지막 참고가를 유지해요.");
  } finally {
    sqlite
      .prepare("UPDATE leases SET until_at=? WHERE name=?")
      .run(Date.now() + 60000, lease);
  }
}
