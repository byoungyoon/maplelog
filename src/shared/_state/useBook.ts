"use client";
import { useQuery } from "@tanstack/react-query";
import type { Ledger } from "@/domain/model";
import type { Report } from "@/server/report";
import { api } from "../_lib/api";
import { useAppState } from "./useAppState";
export interface BookResponse {
  asOf: number;
  book: Ledger;
  report: Report;
  connection: { status: string; reason: string };
  priceProvider: { status: string; reason: string };
  usage: number;
}
export function useBook(enabled = true, currentWeek = false) {
  const { mode, cycle: selectedCycle, offset: selectedOffset } = useAppState();
  const cycle = currentWeek ? "weekly" : selectedCycle;
  const offset = currentWeek ? 0 : selectedOffset;
  return useQuery({
    enabled,
    queryKey: ["book", mode, cycle, offset],
    queryFn: () =>
      api<BookResponse>(`book?mode=${mode}&cycle=${cycle}&offset=${offset}`),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
