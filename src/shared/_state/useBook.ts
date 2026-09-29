"use client";
import { usePathname } from "next/navigation";
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
export function useBook(enabled = true) {
  const { mode, character: selectedCharacter, cycle, offset } = useAppState();
  const pathname = usePathname();
  const character = pathname === "/" ? "all" : selectedCharacter;
  return useQuery({
    enabled,
    queryKey: ["book", mode, character, cycle, offset],
    queryFn: () =>
      api<BookResponse>(
        `book?mode=${mode}&character=${character}&cycle=${cycle}&offset=${offset}`,
      ),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
