import type { Item } from "@/domain/model";

export function visiblePriceItems(items: Item[], search: string) {
  return items.filter((item) => item.price !== null && item.name.includes(search));
}
