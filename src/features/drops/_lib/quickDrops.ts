import type { Boss, Ledger } from "@/domain/model";

export function quickDrops(book: Ledger, boss: Boss) {
  return book.items
    .filter(
      (item) =>
        boss.items.includes(item.id) &&
        (item.price !== null ||
          !/기운|코어 젬스톤|명예|교환권|증표|조각|편린/.test(item.name)),
    )
    .sort((a, b) => {
      if (a.price !== null || b.price !== null) {
        const difference = BigInt(b.price ?? "0") - BigInt(a.price ?? "0");
        if (difference) return difference > 0n ? 1 : -1;
      }
      const prominent = (image?: string | null) =>
        /dark_boss|bright_boss|eternel|whetstone/.test(image ?? "") ? 1 : 0;
      return (
        prominent(b.image) - prominent(a.image) ||
        boss.items.indexOf(a.id) - boss.items.indexOf(b.id)
      );
    })
    .slice(0, 5);
}
