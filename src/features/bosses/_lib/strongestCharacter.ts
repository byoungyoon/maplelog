import type { Character } from "@/domain/model";

export function strongestCharacter(characters: Character[]) {
  return [...characters].sort((a, b) => {
    const left = a.combatPower == null ? -1n : BigInt(a.combatPower);
    const right = b.combatPower == null ? -1n : BigInt(b.combatPower);
    if (left !== right) return left > right ? -1 : 1;
    return b.level - a.level || a.order - b.order || a.id.localeCompare(b.id);
  })[0];
}
