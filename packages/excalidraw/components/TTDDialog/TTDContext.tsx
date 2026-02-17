import { randomId } from "@excalidraw/common";

import { atom } from "../../editor-jotai";

import type { RateLimits, TChat } from "./types";

export const rateLimitsAtom = atom<RateLimits | null>(null);

export const showPreviewAtom = atom<boolean>(false);

export const errorAtom = atom<Error | null>(null);

export const chatHistoryAtom = atom<TChat.ChatHistory>({
  id: randomId(),
  messages: [],
  currentPrompt: "",
});
