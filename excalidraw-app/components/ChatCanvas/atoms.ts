import { atom } from "jotai";
import type { AgentAction } from "./types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  contextElements?: string[]; // Element IDs referenced in this message
  actions?: AgentAction[];
  applied?: boolean;
}

export interface SelectionContext {
  elementIds: string[];
  count: number;
}

// Chat messages history
export const chatMessagesAtom = atom<ChatMessage[]>([]);

// Chat panel visibility
export const isChatPanelOpenAtom = atom<boolean>(true);

// Left sidebar visibility
export const isSidebarOpenAtom = atom<boolean>(true);

// Right panel width (in pixels)
export const chatPanelWidthAtom = atom<number>(350);

// Left sidebar width (in pixels)
export const sidebarWidthAtom = atom<number>(250);

// Selection context from the canvas
export const selectionContextAtom = atom<SelectionContext>({
  elementIds: [],
  count: 0,
});

// Loading state for agent responses
export const isAgentLoadingAtom = atom<boolean>(false);

// Error message for agent
export const agentErrorAtom = atom<string | null>(null);
