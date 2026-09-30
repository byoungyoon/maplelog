import { acquireLease, editBook, readBook, setLease } from "@/server/db";
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
  const status = (await readBook("live")).priceSync;
  if (!force && status?.checkedAt && now - Date.parse(status.checkedAt) < 86400000)
    return { coalesced: true };
  const acquired = await acquireLease(lease, 30000);
  if (!acquired) return { coalesced: true };
  try {
    const response = await fetcher(referencePriceURL, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error("참고 가격을 가져오지 못했어요.");
    const payload = referencePriceSchema.parse(await response.json());
    const checkedAt = new Date().toISOString();
    await editBook((book) => {
        applyReferencePrices(book, payload.item_price, checkedAt);
        book.priceSync = { checkedAt, error: null };
      });
    return { checkedAt, count: Object.keys(payload.item_price).length };
  } catch {
    await editBook((book) => {
        book.priceSync = {
          checkedAt: book.priceSync?.checkedAt ?? null,
          error: "가격 조회에 실패했어요. 마지막 참고가를 유지해요.",
        };
      });
    throw new Error("가격 조회에 실패했어요. 마지막 참고가를 유지해요.");
  } finally {
    await setLease(lease, Date.now() + 60000);
  }
}
