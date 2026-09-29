"use client";
import { create } from "zustand";
import type { Cycle, Mode } from "@/domain/model";
interface AppState {
  entering: boolean;
  entryPlayed: boolean;
  startEntrance: () => void;
  finishEntrance: () => void;
  ambientMotion: boolean;
  toggleAmbientMotion: () => void;
  character: string;
  cycle: Cycle;
  offset: number;
  mode: Mode;
  sheet: string | null;
  toast: string | null;
  setCharacter: (v: string) => void;
  setCycle: (v: Cycle) => void;
  setOffset: (v: number) => void;
  openSheet: (v: string | null) => void;
  notify: (v: string | null) => void;
}
export const useAppState = create<AppState>((set) => ({
  entering: false,
  entryPlayed: false,
  startEntrance: () => set({ entering: true }),
  finishEntrance: () => set({ entering: false, entryPlayed: true }),
  ambientMotion: true,
  toggleAmbientMotion: () => set((s) => ({ ambientMotion: !s.ambientMotion })),
  character: "all",
  cycle: "weekly",
  offset: 0,
  mode: "live",
  sheet: null,
  toast: null,
  setCharacter: (character) => set({ character }),
  setCycle: (cycle) => set({ cycle, offset: 0 }),
  setOffset: (offset) => set({ offset }),
  openSheet: (sheet) => set({ sheet }),
  notify: (toast) => set({ toast }),
}));
