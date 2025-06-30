import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EVENT, getShortcutKey } from "@excalidraw/common";

import { DEFAULT_CATEGORIES } from "@excalidraw/excalidraw/components/CommandPalette/constants/categories";

import { trackEvent } from "../../analytics";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import {
  useApp,
  useExcalidrawActionManager,
  useExcalidrawSetAppState,
} from "../App";
import { Dialog } from "../Dialog";
import { InlineIcon } from "../InlineIcon";
import { TextField } from "../TextField";
import { clockIcon, searchIcon } from "../icons";

import { useStableCallback } from "../../hooks/useStableCallback";

import { useAllCommands } from "./hooks/useAllCommands";
import * as defaultItems from "./constants/defaultCommandPaletteItems";
import "./CommandPalette.scss";
import { useIsCommandAvailable } from "./hooks/useIsCommandAvailable";
import { useRecentCommands } from "./hooks/useRecentCommands";
import { useSearchCommands } from "./hooks/useSearchCommands";
import {
  isCommandPaletteToggleShortcut,
  getNextCommandsByCategory,
} from "./utils";

import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";

import type { CommandPaletteItem } from "./types";
import type { UIAppState } from "../../types";

type CommandPaletteProps = {
  customCommandPaletteItems?: CommandPaletteItem[];
};

export const CommandPalette = Object.assign(
  (props: CommandPaletteProps) => {
    const uiAppState = useUIAppState();
    const setAppState = useExcalidrawSetAppState();

    const commandPaletteShortcut = useCallback(
      (event: KeyboardEvent) => {
        if (isCommandPaletteToggleShortcut(event)) {
          event.preventDefault();
          event.stopPropagation();
          setAppState((appState) => {
            const nextState =
              appState.openDialog?.name === "commandPalette"
                ? null
                : ({ name: "commandPalette" } as const);

            if (nextState) {
              trackEvent("command_palette", "open", "shortcut");
            }

            return {
              openDialog: nextState,
            };
          });
        }
      },
      [setAppState],
    );

    useEffect(() => {
      window.addEventListener(EVENT.KEYDOWN, commandPaletteShortcut, {
        capture: true,
      });
      return () =>
        window.removeEventListener(EVENT.KEYDOWN, commandPaletteShortcut, {
          capture: true,
        });
    }, [commandPaletteShortcut]);

    if (uiAppState.openDialog?.name !== "commandPalette") {
      return null;
    }

    return <CommandPaletteInner {...props} />;
  },
  {
    defaultItems,
  },
);

function CommandPaletteInner({
  customCommandPaletteItems,
}: CommandPaletteProps) {
  const app = useApp();
  const uiAppState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const actionManager = useExcalidrawActionManager();
  const allCommands = useAllCommands(customCommandPaletteItems);

  const { lastUsed, addRecentCommand } = useRecentCommands(allCommands);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [commandSearch, setCommandSearch] = useState("");
  const matchingCommands = useSearchCommands({
    customCommandPaletteItems,
    query: commandSearch,
  });

  const showLastUsed = useMemo(
    () => !commandSearch && lastUsed,
    [commandSearch, lastUsed],
  );

  const [currentCommand, setCurrentCommand] =
    useState<CommandPaletteItem | null>(
      (showLastUsed ? lastUsed : matchingCommands?.[0]) || null,
    );

  const commandsByCategory = useMemo(() => {
    return matchingCommands
      ? getNextCommandsByCategory(
          showLastUsed
            ? matchingCommands.filter(
                (command) => command.label !== lastUsed?.label,
              )
            : matchingCommands,
        )
      : null;
  }, [matchingCommands, showLastUsed, lastUsed]);

  const executeCommand = useStableCallback(
    (
      command: CommandPaletteItem,
      event: React.MouseEvent | React.KeyboardEvent | KeyboardEvent,
    ) => {
      if (uiAppState.openDialog?.name !== "commandPalette") {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      document.body.classList.add("excalidraw-animations-disabled");
      closeCommandPalette(() => {
        command.perform({ actionManager, event });
        addRecentCommand(command);

        requestAnimationFrame(() => {
          document.body.classList.remove("excalidraw-animations-disabled");
        });
      });
    },
  );

  useKeyboardNavigation({
    commands: commandsByCategory,
    lastUsed: lastUsed || null,
    currentCommand,
    query: commandSearch,
    onChange: setCurrentCommand,
    onExecute: executeCommand,
    inputRef,
  });

  useEffect(() => {
    setCurrentCommand(
      (showLastUsed ? lastUsed : matchingCommands?.[0]) || null,
    );
  }, [matchingCommands, lastUsed, showLastUsed]);

  const closeCommandPalette = (cb?: () => void) => {
    setAppState(
      {
        openDialog: null,
      },
      cb,
    );
    setCommandSearch("");
  };

  const hasCommands =
    (commandsByCategory && Object.keys(commandsByCategory).length > 0) ||
    (lastUsed && !commandSearch);
  const showNoResults = !hasCommands && allCommands.length > 0;
  const activeCommandId = currentCommand
    ? `command-item-${currentCommand.label.replace(/\s+/g, "-").toLowerCase()}`
    : undefined;

  return (
    <Dialog
      onCloseRequest={() => closeCommandPalette()}
      closeOnClickOutside
      title={false}
      size={720}
      autofocus
      className="command-palette-dialog"
    >
      <div
        className="search-container"
        role="combobox"
        aria-expanded={hasCommands || showNoResults}
        aria-controls="command-palette-commands"
        aria-activedescendant={activeCommandId}
        tabIndex={0}
      >
        <TextField
          value={commandSearch}
          placeholder={t("commandPalette.search.placeholder")}
          onChange={(value) => {
            setCommandSearch(value);
          }}
          selectOnRender
          ref={inputRef}
        />
      </div>

      {!app.device.viewport.isMobile && (
        <div
          className="shortcuts-wrapper"
          data-testid="command-palette-shortcuts"
        >
          <CommandShortcutHint shortcut="↑↓">
            {t("commandPalette.shortcuts.select")}
          </CommandShortcutHint>
          <CommandShortcutHint shortcut="↵">
            {t("commandPalette.shortcuts.confirm")}
          </CommandShortcutHint>
          <CommandShortcutHint shortcut={getShortcutKey("Esc")}>
            {t("commandPalette.shortcuts.close")}
          </CommandShortcutHint>
        </div>
      )}

      <div
        id="command-palette-commands"
        className="commands"
        role="listbox"
        aria-label="Available commands"
        data-testid="command-palette-commands"
      >
        {lastUsed && !commandSearch && (
          <RecentCommand
            lastUsed={lastUsed}
            currentCommand={currentCommand}
            onExecute={executeCommand}
            onMouseMove={setCurrentCommand}
          />
        )}

        {commandsByCategory && Object.keys(commandsByCategory).length > 0 ? (
          Object.keys(commandsByCategory).map((category) => {
            return (
              <div className="command-category" key={category} role="group">
                <h3 className="command-category-title">{category}</h3>
                {commandsByCategory[category]?.map((command) => (
                  <CommandItem
                    key={command.label}
                    command={command}
                    isSelected={command.label === currentCommand?.label}
                    onClick={(event) => executeCommand(command, event)}
                    onMouseMove={() => setCurrentCommand(command)}
                    showShortcut={!app.device.viewport.isMobile}
                    appState={uiAppState}
                  />
                ))}
              </div>
            );
          })
        ) : showNoResults ? (
          <CommandEmpty />
        ) : null}
      </div>
    </Dialog>
  );
}

const CommandShortcutHint = ({
  shortcut,
  className,
  children,
}: {
  shortcut: string;
  className?: string;
  children?: React.ReactNode;
}) => {
  const shortcuts = shortcut.replace("++", "+$").split("+");

  return (
    <div className={clsx("shortcut", className)}>
      {shortcuts.map((item) => {
        return (
          <div className="shortcut-wrapper" key={item}>
            <div className="shortcut-key">{item === "$" ? "+" : item}</div>
          </div>
        );
      })}
      <div className="shortcut-desc">{children}</div>
    </div>
  );
};

const RecentCommand = ({
  currentCommand,
  lastUsed,
  onExecute,
  onMouseMove,
}: {
  currentCommand: CommandPaletteItem | null;
  lastUsed: CommandPaletteItem | null;
  onExecute: (
    command: CommandPaletteItem,
    event: React.MouseEvent | React.KeyboardEvent | KeyboardEvent,
  ) => void;
  onMouseMove: (command: CommandPaletteItem) => void;
}) => {
  const app = useApp();
  const uiAppState = useUIAppState();

  const isCommandAvailable = useIsCommandAvailable();

  const elements = app.scene.getSelectedElements({
    selectedElementIds: uiAppState.selectedElementIds,
  });

  const isLastCommandForElement = useMemo(
    () =>
      elements.length > 0 && lastUsed?.category === DEFAULT_CATEGORIES.elements,
    [elements, lastUsed],
  );

  if (!lastUsed) {
    return null;
  }

  const categoryTitle = isLastCommandForElement
    ? t("commandPalette.recentsSelection")
    : t("commandPalette.recents");

  return (
    <div
      className="command-category"
      data-testid="command-category-recent"
      role="group"
      aria-labelledby="recent-commands-title"
    >
      <h3
        id="recent-commands-title"
        className="command-category-title"
        data-testid="command-category-title-recent"
      >
        {categoryTitle}
        <div
          className="icon"
          style={{
            marginLeft: "6px",
          }}
          aria-hidden="true"
        >
          {clockIcon}
        </div>
      </h3>
      <CommandItem
        command={lastUsed}
        isSelected={lastUsed.label === currentCommand?.label}
        onClick={(event) => onExecute(lastUsed, event)}
        disabled={!isCommandAvailable(lastUsed)}
        onMouseMove={() => onMouseMove(lastUsed)}
        showShortcut={!app.device.viewport.isMobile}
        appState={uiAppState}
      />
    </div>
  );
};

const CommandEmpty = () => {
  return (
    <div
      className="no-match"
      data-testid="command-palette-no-results"
      role="status"
      aria-live="polite"
    >
      <div className="icon" aria-hidden="true">
        {searchIcon}
      </div>
      {t("commandPalette.search.noMatch")}
    </div>
  );
};

const CommandItem = ({
  command,
  isSelected,
  disabled,
  onMouseMove,
  onClick,
  showShortcut,
  appState,
}: {
  command: CommandPaletteItem;
  isSelected: boolean;
  disabled?: boolean;
  onMouseMove: () => void;
  onClick: (event: React.MouseEvent) => void;
  showShortcut: boolean;
  appState: UIAppState;
}) => {
  const noop = () => {};
  const commandId = `command-item-${command.label
    .replace(/\s+/g, "-")
    .toLowerCase()}`;

  return (
    <div
      id={commandId}
      className={clsx("command-item", {
        "item-selected": isSelected,
        "item-disabled": disabled,
      })}
      ref={(ref) => {
        if (isSelected && !disabled) {
          ref?.scrollIntoView?.({
            block: "nearest",
          });
        }
      }}
      onClick={disabled ? noop : onClick}
      onMouseMove={disabled ? noop : onMouseMove}
      title={disabled ? t("commandPalette.itemNotAvailable") : ""}
      data-testid={commandId}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      tabIndex={-1}
    >
      <div className="name">
        {command.icon && (
          <InlineIcon
            icon={
              typeof command.icon === "function"
                ? command.icon(appState)
                : command.icon
            }
            aria-hidden="true"
          />
        )}
        {command.label}
      </div>
      {showShortcut && command.shortcut && (
        <CommandShortcutHint shortcut={command.shortcut} />
      )}
    </div>
  );
};
