import { EVENT, KEYS, isWritableElement } from "@excalidraw/common";
import { useEffect } from "react";

import { useStableCallback } from "../../../hooks/useStableCallback";
import { isCommandPaletteToggleShortcut } from "../utils";

import { useIsCommandAvailable } from "./useIsCommandAvailable";

import type { CommandPaletteItem } from "../types";

type UseKeyboardNavigationProps = {
  readonly commands: Record<string, CommandPaletteItem[]> | null;
  readonly currentCommand: CommandPaletteItem | null;
  readonly lastUsed: CommandPaletteItem | null;
  readonly query: string;
  readonly onChange: (command: CommandPaletteItem) => void;
  readonly onExecute: (
    command: CommandPaletteItem,
    event: KeyboardEvent,
  ) => void;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
};

export const useKeyboardNavigation = ({
  commands,
  currentCommand,
  lastUsed,
  query,
  onChange,
  onExecute,
  inputRef,
}: UseKeyboardNavigationProps) => {
  const isCommandAvailable = useIsCommandAvailable();

  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {
    const ignoreAlphanumerics =
      isWritableElement(event.target) ||
      isCommandPaletteToggleShortcut(event) ||
      event.key === KEYS.ESCAPE;

    if (
      ignoreAlphanumerics &&
      event.key !== KEYS.ARROW_UP &&
      event.key !== KEYS.ARROW_DOWN &&
      event.key !== KEYS.ENTER
    ) {
      return;
    }

    const matchingCommands = commands ? Object.values(commands).flat() : [];

    const shouldConsiderLastUsed =
      lastUsed && !query && isCommandAvailable(lastUsed);

    if (event.key === KEYS.ARROW_UP) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.label === currentCommand?.label,
      );

      if (shouldConsiderLastUsed) {
        if (index === 0) {
          onChange(lastUsed);
          return;
        }

        if (currentCommand === lastUsed) {
          const nextItem = matchingCommands[matchingCommands.length - 1];
          if (nextItem) {
            onChange(nextItem);
          }
          return;
        }
      }

      let nextIndex;

      if (index === -1) {
        nextIndex = matchingCommands.length - 1;
      } else {
        nextIndex =
          index === 0
            ? matchingCommands.length - 1
            : (index - 1) % matchingCommands.length;
      }

      const nextItem = matchingCommands[nextIndex];
      if (nextItem) {
        onChange(nextItem);
      }

      return;
    }

    if (event.key === KEYS.ARROW_DOWN) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.label === currentCommand?.label,
      );

      if (shouldConsiderLastUsed) {
        if (!currentCommand || index === matchingCommands.length - 1) {
          onChange(lastUsed);
          return;
        }

        if (currentCommand === lastUsed) {
          const nextItem = matchingCommands[0];
          if (nextItem) {
            onChange(nextItem);
          }
          return;
        }
      }

      const nextIndex = (index + 1) % matchingCommands.length;
      const nextItem = matchingCommands[nextIndex];
      if (nextItem) {
        onChange(nextItem);
      }

      return;
    }

    if (event.key === KEYS.ENTER) {
      if (currentCommand) {
        setTimeout(() => {
          onExecute(currentCommand, event);
        });
      }
    }

    if (ignoreAlphanumerics) {
      return;
    }

    // prevent regular editor shortcuts
    event.stopPropagation();

    // if alphanumeric keypress and we're not inside the input, focus it
    if (/^[a-zA-Z0-9]$/.test(event.key)) {
      inputRef?.current?.focus();
      return;
    }

    event.preventDefault();
  });

  useEffect(() => {
    window.addEventListener(EVENT.KEYDOWN, handleKeyDown, {
      capture: true,
    });
    return () =>
      window.removeEventListener(EVENT.KEYDOWN, handleKeyDown, {
        capture: true,
      });
  }, [handleKeyDown]);
};
