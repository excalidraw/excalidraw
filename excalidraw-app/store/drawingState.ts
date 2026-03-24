import { atom } from "../app-jotai";

import type { Client, Drawing } from "../data/types";

export const currentClientIdAtom = atom<string | null>(null);
export const currentDrawingIdAtom = atom<string | null>(null);
export const clientsAtom = atom<Client[]>([]);
export const drawingsAtom = atom<Drawing[]>([]);
export const isSavingAtom = atom<boolean>(false);
export const isLoadingAtom = atom<boolean>(false);
