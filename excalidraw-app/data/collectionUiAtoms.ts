import { atom } from "../app-jotai";

export const activeCollectionDirtyAtom = atom(false);
export const activeSaveLocationAtom = atom<string | null>(null);
export const recoveredFromAutosaveAtom = atom(false);
