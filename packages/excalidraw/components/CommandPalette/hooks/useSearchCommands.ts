import { useMemo } from "react";
import fuzzy from "fuzzy";

import { deburr } from "../../../deburr";

import { useAllCommands } from "./useAllCommands";
import { useIsCommandAvailable } from "./useIsCommandAvailable";

import type { CommandPaletteItem } from "../types";

export const useSearchCommands = ({
  query,
  customCommandPaletteItems,
}: {
  query: string;
  customCommandPaletteItems?: CommandPaletteItem[];
}) => {
  const allCommands = useAllCommands(customCommandPaletteItems);
  const isCommandAvailable = useIsCommandAvailable();

  const filteredCommands = useMemo(
    () =>
      allCommands
        ?.filter(isCommandAvailable)
        .sort((a, b) => a.order - b.order) ?? [],
    [allCommands, isCommandAvailable],
  );

  const _query = deburr(query.toLocaleLowerCase().replace(/[<>_| -]/g, ""));

  const searchedCommands = useMemo(() => {
    if (!filteredCommands.length) {
      return [];
    }

    return fuzzy
      .filter(_query, filteredCommands, {
        extract: (command) => command.haystack,
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.original);
  }, [_query, filteredCommands]);

  return searchedCommands;
};
