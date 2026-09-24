import { atom } from "../app-jotai";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const saveStatusAtom = atom<SaveStatus>("idle");
export const lastSavedAtAtom = atom<number | null>(null);
export const saveErrorMessageAtom = atom<string | null>(null);
