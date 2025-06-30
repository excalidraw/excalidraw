import { useCallback, useEffect, useMemo } from "react";

import { atom, useAtom } from "../../../editor-jotai";

import { DEFAULT_CATEGORIES } from "../constants/categories";

import { useIsCommandAvailable } from "./useIsCommandAvailable";

import type { CommandPaletteItem } from "../types";

const MAX_RECENT_COMMANDS = 5;

export const recentCommandsHistory = atom<CommandPaletteItem[]>([]);

export const useRecentCommands = (allCommands: CommandPaletteItem[]) => {
  const isCommandAvailable = useIsCommandAvailable();
  const [recentCommands, setRecentCommands] = useAtom(recentCommandsHistory);

  const addRecentCommand = useCallback(
    (command: CommandPaletteItem) => {
      setRecentCommands((prev) =>
        [command, ...prev].slice(0, MAX_RECENT_COMMANDS),
      );
    },
    [setRecentCommands],
  );

  const lastUsed = useMemo(() => {
    const elementsCommand = recentCommands.find(
      (command) =>
        command.category === DEFAULT_CATEGORIES.elements &&
        isCommandAvailable(command),
    );

    return (
      elementsCommand ||
      recentCommands.find((command) => isCommandAvailable(command))
    );
  }, [recentCommands, isCommandAvailable]);

  useEffect(() => {
    setRecentCommands((previousRecentCommands) =>
      previousRecentCommands.filter((command) =>
        allCommands.some((c) => c.label === command.label),
      ),
    );
  }, [allCommands, setRecentCommands]);

  return {
    addRecentCommand,
    lastUsed,
    setRecentCommands,
    recentCommands,
  };
};
