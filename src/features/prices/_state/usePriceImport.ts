"use client";
import { useState } from "react";
import { useCommand } from "@/shared/_action/useCommand";
import { useAppState } from "@/shared/_state/useAppState";
import { readPriceImport } from "../_lib/readPriceImport";
export function usePriceImport() {
  const [busy, setBusy] = useState(false);
  const command = useCommand();
  const notify = useAppState((s) => s.notify);
  return {
    busy: busy || command.isPending,
    importFile: async (file: File) => {
      setBusy(true);
      try {
        const payload = await readPriceImport(file);
        await command.mutateAsync(payload);
        notify(`${payload.quotes.length}개의 기준가를 가져왔어요.`);
      } catch {
        notify("가격 파일의 아이템 ID·금액·시장·조건을 확인해 주세요.");
      } finally {
        setBusy(false);
      }
    },
  };
}
