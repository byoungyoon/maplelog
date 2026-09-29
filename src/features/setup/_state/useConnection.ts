"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/_lib/api";
export function useConnection() {
  return useQuery({
    queryKey: ["connection"],
    queryFn: () =>
      api<{ connected: boolean; verifiedAt: string | null }>(
        "connection/status",
      ),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
