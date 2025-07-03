import { KEYS } from "@excalidraw/common";

import type { CommandPaletteItem } from "./types";

export const isCommandPaletteToggleShortcut = (event: KeyboardEvent) => {
  return (
    !event.altKey &&
    event[KEYS.CTRL_OR_CMD] &&
    ((event.shiftKey && event.key.toLowerCase() === KEYS.P) ||
      event.key === KEYS.SLASH)
  );
};

export const getNextCommandsByCategory = (commands: CommandPaletteItem[]) => {
  const nextCommandsByCategory: Record<string, CommandPaletteItem[]> = {};
  for (const command of commands) {
    if (nextCommandsByCategory[command.category]) {
      nextCommandsByCategory[command.category].push(command);
    } else {
      nextCommandsByCategory[command.category] = [command];
    }
  }

  return nextCommandsByCategory;
};
