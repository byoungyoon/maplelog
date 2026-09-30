import { z } from "zod";
import type { Ledger } from "@/domain/model";
import snapshot from "@/data/scouter-item-prices.json" with { type: "json" };
export const referencePriceSchema = z.object({
  success: z.literal(true),
  item_price: z.record(
    z.string().max(100),
    z.string().regex(/^\d{1,12}(\.\d{1,8})?$/),
  ),
});
export const referencePriceURL = snapshot.source;
export function eokToMeso(value: string) {
  if (!/^\d{1,12}(\.\d{1,8})?$/.test(value))
    throw new Error("잘못된 가격 단위예요.");
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 100000000n +
    BigInt(fraction.padEnd(8, "0"))
  ).toString();
}
export function applyReferencePrices(
  book: Ledger,
  quotes: Record<string, string> = snapshot.item_price,
  checkedAt = snapshot.checkedAt,
) {
  let changed = false;
  for (const item of book.items) {
    if (
      item.source === "manual" ||
      !Object.hasOwn(quotes, item.name) ||
      item.observedAt > checkedAt
    )
      continue;
    const price = eokToMeso(quotes[item.name]);
    if (item.price === price && item.observedAt === checkedAt) continue;
    item.price = price;
    item.source = "scouter";
    item.observedAt = checkedAt;
    item.market = "참고가 · 서버 미구분";
    // Unbound shared boss rewards are the basis of this personal drop estimate.
    if (
      item.tradeConfirmed === false &&
      !item.variant.startsWith("개인 귀속")
    ) {
      item.tradable = true;
      item.tradeConfirmed = true;
      item.variant = "획득 직후 거래 가능 기준";
    }
    changed = true;
  }
  return changed;
}
