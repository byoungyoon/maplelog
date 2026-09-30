"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Character } from "@/domain/model";
import { api } from "@/shared/_lib/api";

export function useCharacterStrength(characters?: Character[], asOf = 0) {
  const client = useQueryClient();
  return useQuery({
    queryKey: [
      "character-strength",
      characters
        ?.map((c) => c.id)
        .sort()
        .join(","),
    ],
    enabled: !!characters?.some(
      (c) =>
        !c.combatPowerCheckedAt ||
        asOf - Date.parse(c.combatPowerCheckedAt) > 86400000,
    ),
    queryFn: async () => {
      const result = await api<{
        coalesced: boolean;
        success: number;
        failed: number;
      }>("characters/strength", {});
      await client.invalidateQueries({ queryKey: ["book"] });
      return result;
    },
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
