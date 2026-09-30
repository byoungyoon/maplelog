"use client";
import { useQuery } from "@tanstack/react-query";
import type { BossAnalysis } from "@/domain/boss-cut";
import { api } from "@/shared/_lib/api";

export function useBossAnalysis(characterId?: string) {
  return useQuery({
    queryKey: ["boss-analysis", characterId],
    enabled: !!characterId,
    queryFn: () => api<BossAnalysis>("bosses/analyze", { characterId }),
    staleTime: 600000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
