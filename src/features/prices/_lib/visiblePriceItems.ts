import listings from "@/data/auction-listings.json";
import type { Item } from "@/domain/model";

const unlistedNames = new Set(
  listings.items
    .filter((item) => item.listingCount === 0)
    .map((item) => item.name),
);

// Hide only confirmed zero-result searches. Unchecked items remain visible;
// the ledger and historical drop references are never modified here.
export function visiblePriceItems(items: Item[], search: string) {
  return items.filter(
    (item) => !unlistedNames.has(item.name) && item.name.includes(search),
  );
}
