import { useEffect, useState } from "react";
import {
  useApp,
  useAppProps,
  useExcalidrawActionManager,
  useExcalidrawSetAppState,
} from "../../packages/excalidraw/components/App";
import { KEYS } from "../../packages/excalidraw/keys";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import { TextField } from "../../packages/excalidraw/components/TextField";
import clsx from "clsx";
import { getSelectedElements } from "../../packages/excalidraw/scene";
import { Action } from "../../packages/excalidraw/actions/types";
import { TranslationKeys, t } from "../../packages/excalidraw/i18n";
import {
  ShortcutName,
  getShortcutFromShortcutName,
} from "../../packages/excalidraw/actions/shortcuts";
import { DEFAULT_SIDEBAR, EVENT } from "../../packages/excalidraw/constants";
import {
  clockIcon,
  searchIcon,
} from "../../packages/excalidraw/components/icons";
import fuzzy from "fuzzy";
import { useUIAppState } from "../../packages/excalidraw/context/ui-appState";
import { AppState, ToolType } from "../../packages/excalidraw/types";
import { getShortcutKey } from "../../packages/excalidraw/utils";
import { atom, useAtom } from "jotai";
import { deburr } from "../../packages/excalidraw/deburr";

import "./CommandPalette.scss";
import { MarkRequired } from "../../packages/excalidraw/utility-types";

export type CommandPaletteItem = {
  name: string;
  /** string we should match against when searching (deburred name + aliases) */
  haystack?: string;
  category: string;
  order: number;
  predicate: boolean | Action["predicate"];
  shortcut?: string;
  execute: () => void;
};

export const lastUsedPaletteItem = atom<CommandPaletteItem | null>(null);

export const DEFAULT_CATEGORIES = {
  app: "App",
  export: "Export",
  tool: "Tool",
  editor: "Editor",
  elements: "Elements",
  links: "Links",
};

export const getCategoryOrder = (category: string) => {
  switch (category) {
    case DEFAULT_CATEGORIES.app:
      return 1;
    case DEFAULT_CATEGORIES.editor:
      return 2;
    case DEFAULT_CATEGORIES.tool:
      return 3;
    case DEFAULT_CATEGORIES.export:
      return 4;
    case DEFAULT_CATEGORIES.elements:
      return 5;
    case DEFAULT_CATEGORIES.links:
      return 6;
    default:
      return 10;
  }
};

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
      {shortcuts.map((item, idx) => {
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

type CommandPaletteProps = {
  customCommandPaletteItems: CommandPaletteItem[];
};
export default function CommandPalette(props: CommandPaletteProps) {
  const uiAppState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  useEffect(() => {
    const commandPaletteShortcut = (
      event: KeyboardEvent | React.KeyboardEvent,
    ) => {
      if (
        event[KEYS.CTRL_OR_CMD] &&
        event.key === KEYS.P &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        setAppState((appState) => ({
          openDialog:
            appState.openDialog?.name === "commandPalette"
              ? null
              : { name: "commandPalette" },
        }));
      }
    };
    window.addEventListener(EVENT.KEYDOWN, commandPaletteShortcut, {
      capture: true,
    });
    return () =>
      window.removeEventListener(EVENT.KEYDOWN, commandPaletteShortcut, {
        capture: true,
      });
  }, [setAppState]);

  if (uiAppState.openDialog?.name !== "commandPalette") {
    return null;
  }

  return <CommandPaletteInner {...props} />;
}

function CommandPaletteInner({
  customCommandPaletteItems,
}: CommandPaletteProps) {
  const app = useApp();
  const uiAppState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const appProps = useAppProps();
  const actionManager = useExcalidrawActionManager();

  const [lastUsed, setLastUsed] = useAtom(lastUsedPaletteItem);
  const [allCommands, setAllCommands] = useState<
    MarkRequired<CommandPaletteItem, "haystack">[]
  >([]);

  useEffect(() => {
    const getActionLabel = (action: Action) => {
      let label = "";
      if (action.label) {
        if (typeof action.label === "function") {
          label = t(
            action.label(
              app.scene.getNonDeletedElements(),
              uiAppState as AppState,
              app,
            ) as unknown as TranslationKeys,
          );
        } else {
          label = t(action.label as unknown as TranslationKeys);
        }
      }
      return label;
    };

    let commandsFromActions: CommandPaletteItem[] = [];

    if (uiAppState && app.scene && actionManager) {
      const elementsCommands: CommandPaletteItem[] = [
        actionManager.actions.group,
        actionManager.actions.ungroup,
        actionManager.actions.cut,
        actionManager.actions.copy,
        actionManager.actions.deleteSelectedElements,
        actionManager.actions.copyStyles,
        actionManager.actions.pasteStyles,
        actionManager.actions.sendBackward,
        actionManager.actions.sendToBack,
        actionManager.actions.bringForward,
        actionManager.actions.bringToFront,
        actionManager.actions.alignTop,
        actionManager.actions.alignBottom,
        actionManager.actions.alignLeft,
        actionManager.actions.alignRight,
        actionManager.actions.duplicateSelection,
        actionManager.actions.flipHorizontal,
        actionManager.actions.flipVertical,
        actionManager.actions.zoomToFitSelection,
        actionManager.actions.zoomToFitSelectionInViewport,
        actionManager.actions.increaseFontSize,
        actionManager.actions.decreaseFontSize,
      ].map((action: Action) => ({
        name: getActionLabel(action),
        category: DEFAULT_CATEGORIES.elements,
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        predicate: action.predicate
          ? action.predicate
          : (elements, appState, appProps, app) => {
              const selectedElements = getSelectedElements(elements, appState);
              return selectedElements.length > 0;
            },
        order: getCategoryOrder(DEFAULT_CATEGORIES.elements),
        execute: () => {
          actionManager.executeAction(action, "commandPalette");
        },
      }));

      const toolCommands: CommandPaletteItem[] = [
        actionManager.actions.toggleHandTool,
        actionManager.actions.setFrameAsActiveTool,
        actionManager.actions.toggleEraserTool,
      ].map((action) => ({
        name: getActionLabel(action),
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        category: DEFAULT_CATEGORIES.tool,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        predicate: true,
        execute: () => actionManager.executeAction(action, "commandPalette"),
      }));

      const editorCommands: CommandPaletteItem[] = [
        actionManager.actions.undo,
        actionManager.actions.redo,
        actionManager.actions.clearCanvas,
        actionManager.actions.toggleTheme,
        actionManager.actions.zoomIn,
        actionManager.actions.zoomOut,
        actionManager.actions.zoomToFit,
        actionManager.actions.resetZoom,
        actionManager.actions.zenMode,
        actionManager.actions.viewMode,
        actionManager.actions.objectsSnapMode,
        actionManager.actions.toggleShortcuts,
        actionManager.actions.toggleElementLock,
        actionManager.actions.unlockAllElements,
        actionManager.actions.stats,
      ].map((action) => ({
        name: getActionLabel(action),
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        category: DEFAULT_CATEGORIES.editor,
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.editor),
        execute: () => actionManager.executeAction(action, "commandPalette"),
      }));

      const exportCommands: CommandPaletteItem[] = [
        actionManager.actions.copyAsPng,
        actionManager.actions.copyAsSvg,
        actionManager.actions.saveToActiveFile,
        actionManager.actions.saveFileToDisk,
      ].map((action) => ({
        name: getActionLabel(action),
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        category: DEFAULT_CATEGORIES.export,
        order: getCategoryOrder(DEFAULT_CATEGORIES.export),
        predicate: action.predicate ?? true,
        execute: () => actionManager.executeAction(action, "commandPalette"),
      }));

      commandsFromActions = [
        ...elementsCommands,
        ...toolCommands,
        ...editorCommands,
        ...exportCommands,
      ];
    }

    const toolBarCommands: CommandPaletteItem[] = (
      [
        ["selection", KEYS[1]],
        ["rectangle", KEYS[2]],
        ["diamond", KEYS[3]],
        ["ellipse", KEYS[4]],
        ["line", KEYS[5]],
        ["arrow", KEYS[6]],
        ["freedraw", KEYS[7]],
        ["text", KEYS[8]],
        ["image", KEYS[9]],
        ["laser", KEYS.K],
      ] as Array<[ToolType, string]>
    ).map(([name, key]) => ({
      name: t(`toolBar.${name}` as any),
      category: DEFAULT_CATEGORIES.tool,
      shortcut: key,
      predicate: true,
      order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
      execute: () => {
        app.setActiveTool({
          type: name as ToolType,
        });
      },
    }));

    const additionalCommands: CommandPaletteItem[] = [
      ...toolBarCommands,
      {
        name: t("labels.excalidrawLib"),
        category: DEFAULT_CATEGORIES.app,
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.app),
        execute: () => {
          if (uiAppState.openSidebar) {
            setAppState({
              openSidebar: null,
            });
          } else {
            setAppState({
              openSidebar: {
                name: DEFAULT_SIDEBAR.name,
                tab: DEFAULT_SIDEBAR.defaultTab,
              },
            });
          }
        },
      },
      {
        name: `${t("overwriteConfirm.action.exportToImage.title")}...`,
        category: DEFAULT_CATEGORIES.export,
        shortcut: getShortcutFromShortcutName("imageExport"),
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.export),
        execute: () => {
          setAppState({ openDialog: { name: "imageExport" } });
        },
      },
      {
        name: "GitHub",
        category: DEFAULT_CATEGORIES.links,
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.links),
        execute: () => {
          window.open("https://github.com/excalidraw/excalidraw", "_blank");
        },
      },
      {
        name: t("labels.followUs"),
        category: DEFAULT_CATEGORIES.links,
        order: getCategoryOrder(DEFAULT_CATEGORIES.links),
        predicate: true,
        execute: () => {
          window.open("https://x.com/excalidraw", "_blank");
        },
      },
      {
        name: t("labels.discordChat"),
        category: DEFAULT_CATEGORIES.links,
        order: getCategoryOrder(DEFAULT_CATEGORIES.links),
        predicate: true,
        execute: () => {
          window.open("https://discord.gg/UexuTaE", "_blank");
        },
      },
      {
        name: t("overwriteConfirm.action.excalidrawPlus.title"),
        category: DEFAULT_CATEGORIES.links,
        order: getCategoryOrder(DEFAULT_CATEGORIES.links),
        predicate: true,
        execute: () => {
          window.open(
            `${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`,
            "_blank",
          );
        },
      },
      {
        name: t("toolBar.lock"),
        category: DEFAULT_CATEGORIES.tool,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        shortcut: KEYS.Q.toLocaleUpperCase(),
        predicate: true,
        execute: () => {
          app.toggleLock();
        },
      },
      {
        name: `${t("labels.textToDiagram")}...`,
        category: DEFAULT_CATEGORIES.tool,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        predicate: appProps.aiEnabled,
        execute: () => {
          setAppState((state) => ({
            ...state,
            openDialog: {
              name: "ttd",
              tab: "text-to-diagram",
            },
          }));
        },
      },
      {
        name: `${t("toolBar.mermaidToExcalidraw")}...`,
        category: DEFAULT_CATEGORIES.tool,
        predicate: appProps.aiEnabled,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        execute: () => {
          setAppState((state) => ({
            ...state,
            openDialog: {
              name: "ttd",
              tab: "mermaid",
            },
          }));
        },
      },
      {
        name: `${t("toolBar.magicframe")}...`,
        category: DEFAULT_CATEGORIES.tool,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        predicate: appProps.aiEnabled,
        execute: () => {
          app.onMagicframeToolSelect();
        },
      },
    ];

    setAllCommands(
      [
        ...commandsFromActions,
        ...additionalCommands,
        ...customCommandPaletteItems,
      ].map((command) => ({
        ...command,
        haystack: deburr(command.name),
      })),
    );
  }, [
    app,
    appProps,
    uiAppState,
    actionManager,
    setAppState,
    lastUsed,
    customCommandPaletteItems,
  ]);

  const [commandSearch, setCommandSearch] = useState("");
  const [currentCommand, setCurrentCommand] =
    useState<CommandPaletteItem | null>(null);
  const [commandsByCategory, setCommandsByCategory] = useState<
    Record<string, CommandPaletteItem[]>
  >({});

  const closeCommandPalette = (cb?: () => void) => {
    setAppState(
      {
        openDialog: null,
      },
      cb,
    );
    setCommandSearch("");
  };

  const executeCommand = (command: CommandPaletteItem) => {
    if (uiAppState.openDialog?.name === "commandPalette") {
      closeCommandPalette(() => {
        command.execute();
        setLastUsed(command);
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent | KeyboardEvent) => {
    const matchingCommands = Object.values(commandsByCategory).flat();
    const considerLastUsed = lastUsed && !commandSearch;

    if (event.key === KEYS.ARROW_UP) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.name === currentCommand?.name,
      );

      if (considerLastUsed) {
        if (index === 0) {
          setCurrentCommand(lastUsed);
          return;
        }

        if (currentCommand === lastUsed) {
          const nextItem = matchingCommands[matchingCommands.length - 1];
          if (nextItem) {
            setCurrentCommand(nextItem);
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
        setCurrentCommand(nextItem);
      }

      return;
    }

    if (event.key === KEYS.ARROW_DOWN) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.name === currentCommand?.name,
      );

      if (considerLastUsed) {
        if (!currentCommand || index === matchingCommands.length - 1) {
          setCurrentCommand(lastUsed);
          return;
        }

        if (currentCommand === lastUsed) {
          const nextItem = matchingCommands[0];
          if (nextItem) {
            setCurrentCommand(nextItem);
          }
          return;
        }
      }

      const nextIndex = (index + 1) % matchingCommands.length;
      const nextItem = matchingCommands[nextIndex];
      if (nextItem) {
        setCurrentCommand(nextItem);
      }

      return;
    }

    if (event.key === KEYS.ENTER) {
      if (currentCommand) {
        executeCommand(currentCommand);
      }
    }
  };

  useEffect(() => {
    const getNextCommandsByCategory = (commands: CommandPaletteItem[]) => {
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

    let matchingCommands = allCommands
      .filter((command) =>
        typeof command.predicate === "function"
          ? command.predicate(
              app.scene.getNonDeletedElements(),
              uiAppState as AppState,
              appProps,
              app,
            )
          : command.predicate,
      )
      .sort((a, b) => a.order - b.order);

    if (!commandSearch) {
      setCommandsByCategory(
        getNextCommandsByCategory(
          matchingCommands.filter((command) => command.name !== lastUsed?.name),
        ),
      );
      setCurrentCommand(null);
      return;
    }

    matchingCommands = fuzzy
      .filter(deburr(commandSearch.trim()), matchingCommands, {
        extract: (command) => command.haystack,
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.original);

    setCommandsByCategory(getNextCommandsByCategory(matchingCommands));
    setCurrentCommand(matchingCommands[0]);
  }, [commandSearch, uiAppState, allCommands, appProps, app, lastUsed]);

  return (
    <Dialog
      onCloseRequest={() => closeCommandPalette()}
      closeOnClickOutside
      title={false}
      size={600}
      autofocus
      className="command-palette-dialog"
    >
      <TextField
        value={commandSearch}
        placeholder={t("commandPalette.search.placeholder")}
        onChange={(value) => {
          setCommandSearch(value);
        }}
        onKeyDown={handleKeyDown}
        selectOnRender
      />

      <div className="shortcuts-wrapper">
        <CommandShortcutHint shortcut="↑↓">
          {t("commandPalette.shortcuts.select")}
        </CommandShortcutHint>
        <CommandShortcutHint shortcut="↵">
          {t("commandPalette.shortcuts.execute")}
        </CommandShortcutHint>
        <CommandShortcutHint shortcut={getShortcutKey("CtrlOrCmd+P")}>
          {t("commandPalette.shortcuts.close")}
        </CommandShortcutHint>
      </div>

      <div className="commands">
        {lastUsed && !commandSearch && (
          <div className="command-category">
            <div className="command-category-title">
              {t("commandPalette.recents")}
              <div
                className="icon"
                style={{
                  marginLeft: "6px",
                }}
              >
                {clockIcon}
              </div>
            </div>
            <CommandItem
              command={lastUsed}
              isSelected={lastUsed.name === currentCommand?.name}
              onClick={() => executeCommand(lastUsed)}
              onMouseMove={() => setCurrentCommand(lastUsed)}
            />
          </div>
        )}

        {Object.keys(commandsByCategory).length > 0 ? (
          Object.keys(commandsByCategory).map((category, idx) => {
            return (
              <div className="command-category" key={category}>
                <div className="command-category-title">{category}</div>
                {commandsByCategory[category].map((command) => (
                  <CommandItem
                    key={command.name}
                    command={command}
                    isSelected={command.name === currentCommand?.name}
                    onClick={() => executeCommand(command)}
                    onMouseMove={() => setCurrentCommand(command)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          <div className="no-match">
            <div className="icon">{searchIcon}</div>{" "}
            {t("commandPalette.search.noMatch")}
          </div>
        )}
      </div>
    </Dialog>
  );
}

const CommandItem = ({
  command,
  isSelected,
  onMouseMove,
  onClick,
}: {
  command: CommandPaletteItem;
  isSelected: boolean;
  onMouseMove: () => void;
  onClick: () => void;
}) => {
  return (
    <div
      className={clsx("command-item", {
        "selected-item": isSelected,
      })}
      ref={(ref) => {
        if (isSelected) {
          ref?.scrollIntoView?.({
            block: "nearest",
          });
        }
      }}
      onClick={onClick}
      onMouseMove={onMouseMove}
    >
      <div>{command.name}</div>
      {command.shortcut && <CommandShortcutHint shortcut={command.shortcut} />}
    </div>
  );
};
