/**
 * The settings atom — the in-memory view of `settingsStore`, so any component
 * can read the resolved endpoints without touching storage on every render.
 */

import { atom } from "../app-jotai";

import { loadSettings, saveSettings } from "./settingsStore";

import type { Settings } from "./settingsStore";

export const settingsAtom = atom<Settings>(loadSettings());

/** Whether the Settings dialog is open. */
export const settingsDialogStateAtom = atom<{ isOpen: boolean }>({
  isOpen: false,
});

/** Whether the "how to use" welcome is open. */
export const welcomeDialogStateAtom = atom<{ isOpen: boolean }>({
  isOpen: false,
});

/** Whether the read-only tickets board is open. */
export const ticketsDialogStateAtom = atom<{ isOpen: boolean }>({
  isOpen: false,
});

/** Persist and publish in one step. */
export const persistSettings = (
  set: (update: Settings) => void,
  next: Settings,
): void => {
  saveSettings(next);
  set(next);
};
