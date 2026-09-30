"use client";
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "../_state/useAppState";
import { useBook } from "../_state/useBook";
import { api, ApiError } from "../_lib/api";
import type { Command } from "@/domain/commands";
export function useCommand(enabled = true, currentWeek = false) {
  const q = useQueryClient();
  const { mode, notify } = useAppState();
  const book = useBook(enabled, currentWeek);
  const ticket = useRef<{
    fingerprint: string;
    revision: number;
    requestId: string;
  } | null>(null);
  return useMutation({
    mutationKey: ["command"],
    retry: false,
    mutationFn: async (command: Command) => {
      if (!book.data) throw new Error("장부를 먼저 불러와 주세요.");
      const fingerprint = JSON.stringify({ mode, command });
      if (!ticket.current || ticket.current.fingerprint !== fingerprint)
        ticket.current = {
          fingerprint,
          revision: book.data.book.revision,
          requestId: crypto.randomUUID(),
        };
      return api(`command?mode=${mode}`, {
        revision: ticket.current.revision,
        requestId: ticket.current.requestId,
        command,
      });
    },
    onSuccess: async () => {
      ticket.current = null;
      await q.invalidateQueries({ queryKey: ["book"] });
    },
    onError: async (error) => {
      notify(error.message);
      if (error instanceof ApiError && error.status === 409) {
        ticket.current = null;
        await q.invalidateQueries({ queryKey: ["book"] });
      }
    },
  });
}
