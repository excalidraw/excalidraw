import { useEffect, useState } from "react";
import {
  useApp,
  useAppProps,
  useExcalidrawActionManager,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../../packages/excalidraw/components/App";
import { KEYS } from "../../packages/excalidraw/keys";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import { TextField } from "../../packages/excalidraw/components/TextField";

import clsx from "clsx";
import "./CommandPalette.scss";
import { getSelectedElements } from "../../packages/excalidraw/scene";
import { Action } from "../../packages/excalidraw/actions/types";
import { TranslationKeys, t } from "../../packages/excalidraw/i18n";
import {
  ShortcutName,
  getShortcutFromShortcutName,
} from "../../packages/excalidraw/actions/shortcuts";
import { atom, useAtomValue } from "jotai";
import { DEFAULT_SIDEBAR } from "../../packages/excalidraw/constants";

export const commandPaletteAtom = atom(false);

export type CommandPaletteItem = {
  name: string;
  category: string;
  order: number;
  predicate: boolean | Action["predicate"];
  shortcut?: string;
  execute: () => void;
};

export const DEFAULT_CATEGORIES = {
  app: "App",
  export: "Export",
  tool: "Tool",
  editor: "Editor",
  elements: "Elements",
  social: "Social",
  promotion: "Promotion",
};

export const getCategoryOrder = (category: string) => {
  switch (category) {
    case DEFAULT_CATEGORIES.app:
      return 1;
    case DEFAULT_CATEGORIES.export:
      return 2;
    case DEFAULT_CATEGORIES.tool:
      return 3;
    case DEFAULT_CATEGORIES.editor:
      return 4;
    case DEFAULT_CATEGORIES.elements:
      return 5;
    case DEFAULT_CATEGORIES.social:
      return 6;
    case DEFAULT_CATEGORIES.promotion:
      return 7;
    default:
      return 10;
  }
};

const CommandShortcutHint = ({
  shortcut,
  selected,
  className,
  children,
}: {
  shortcut: string;
  selected?: boolean;
  className?: string;
  children?: React.ReactNode;
}) => {
  const shortcuts = shortcut.replace("++", "+$").split("+");

  return (
    <div className={clsx("shortcut", className)}>
      {shortcuts.map((item, idx) => {
        return (
          <>
            {idx > 0 && <div className="shortcut-plus"> + </div>}
            <div className={clsx("shortcut-key", selected ? "selected" : "")}>
              {item === "$" ? "+" : item}
            </div>
          </>
        );
      })}
      <div className="shortcut-desc">{children}</div>
    </div>
  );
};

export default function CommandPalette({
  onClose,
  customCommandPaletteItems,
}: {
  onClose: () => void;
  customCommandPaletteItems: CommandPaletteItem[];
}) {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const appProps = useAppProps();
  const actionManager = useExcalidrawActionManager();

  const isPaletteVisible = useAtomValue(commandPaletteAtom);

  const [allCommands, setAllCommands] = useState<CommandPaletteItem[]>([]);
  useEffect(() => {
    const getActionLabel = (action: Action) => {
      let label = "";
      if (action.label) {
        if (typeof action.label === "function") {
          label = t(
            action.label(
              app.scene.getNonDeletedElements(),
              appState,
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

    if (appState && app.scene && actionManager) {
      const elementsCommands: CommandPaletteItem[] = [
        actionManager.actions.group,
        actionManager.actions.ungroup,
        actionManager.actions.zoomToFitSelection,
        actionManager.actions.zoomToFitSelectionInViewport,
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
        actionManager.actions.stats,
        actionManager.actions.zoomIn,
        actionManager.actions.zoomOut,
        actionManager.actions.zoomToFit,
        actionManager.actions.zenMode,
        actionManager.actions.viewMode,
        actionManager.actions.objectsSnapMode,
        actionManager.actions.toggleTheme,
        actionManager.actions.toggleShortcuts,
        actionManager.actions.clearCanvas,
        actionManager.actions.toggleElementLock,
        actionManager.actions.unlockAllElements,
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

    const additionalCommands: CommandPaletteItem[] = [
      {
        name: t("labels.excalidrawLib"),
        category: DEFAULT_CATEGORIES.app,
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.app),
        execute: () => {
          if (appState.openSidebar) {
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
        name: t("overwriteConfirm.action.exportToImage.title"),
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
        category: DEFAULT_CATEGORIES.social,
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.social),
        execute: () => {
          window.open("https://github.com/excalidraw/excalidraw", "_blank");
        },
      },
      {
        name: t("labels.followUs"),
        category: DEFAULT_CATEGORIES.social,
        order: getCategoryOrder(DEFAULT_CATEGORIES.social),
        predicate: true,
        execute: () => {
          window.open("https://x.com/excalidraw", "_blank");
        },
      },
      {
        name: t("labels.discordChat"),
        category: DEFAULT_CATEGORIES.social,
        order: getCategoryOrder(DEFAULT_CATEGORIES.social),
        predicate: true,
        execute: () => {
          window.open("https://discord.gg/UexuTaE", "_blank");
        },
      },
      {
        name: t("overwriteConfirm.action.excalidrawPlus.title"),
        category: DEFAULT_CATEGORIES.promotion,
        order: getCategoryOrder(DEFAULT_CATEGORIES.promotion),
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
        name: t("toolBar.laser"),
        category: DEFAULT_CATEGORIES.tool,
        shortcut: KEYS.K.toLocaleUpperCase(),
        predicate: true,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        execute: () => {
          app.setActiveTool({
            type: "laser",
          });
        },
      },
      {
        name: t("labels.textToDiagram"),
        category: DEFAULT_CATEGORIES.tool,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        predicate: true,
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
        name: t("toolBar.mermaidToExcalidraw"),
        category: DEFAULT_CATEGORIES.tool,
        predicate: true,
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
        name: t("toolBar.magicframe"),
        category: DEFAULT_CATEGORIES.tool,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tool),
        predicate: true,
        execute: () => {
          app.onMagicframeToolSelect();
        },
      },
    ];

    setAllCommands([
      ...commandsFromActions,
      ...additionalCommands,
      ...customCommandPaletteItems,
    ]);
  }, [
    app,
    appProps,
    appState,
    actionManager,
    setAppState,
    customCommandPaletteItems,
  ]);

  const [commandSearch, setCommandSearch] = useState("");
  const [currentOption, setCurrentOption] = useState<CommandPaletteItem | null>(
    null,
  );
  const [commandsByCategory, setCommandsByCategory] = useState<
    Record<string, CommandPaletteItem[]>
  >({});

  const closeCommandPalette = () => {
    setCommandSearch("");
    onClose();
  };

  const executeCommand = (command: CommandPaletteItem) => {
    if (isPaletteVisible) {
      command.execute();
      closeCommandPalette();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent | KeyboardEvent) => {
    const availableCommands = Object.values(commandsByCategory).flat();

    if (event.key === KEYS.ARROW_UP) {
      event.preventDefault();
      if (currentOption === null && availableCommands.length > 0) {
        setCurrentOption(availableCommands[0]);
      } else {
        const index = availableCommands.findIndex(
          (item) => item.name === currentOption!.name,
        );
        const nextIndex =
          index === 0
            ? availableCommands.length - 1
            : (index - 1) % availableCommands.length;
        const nextItem = availableCommands[nextIndex];
        if (nextItem) {
          setCurrentOption(nextItem);
        }
      }
    } else if (event.key === KEYS.ARROW_DOWN) {
      event.preventDefault();
      if (currentOption === null && availableCommands.length > 0) {
        setCurrentOption(availableCommands[0]);
      } else {
        const index = availableCommands.findIndex(
          (item) => item.name === currentOption!.name,
        );
        const nextIndex = (index + 1) % availableCommands.length;
        const nextItem = availableCommands[nextIndex];
        if (nextItem) {
          setCurrentOption(nextItem);
        }
      }
    } else if (event.key === KEYS.ENTER) {
      if (currentOption) {
        executeCommand(currentOption);
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
              appState,
              appProps,
              app,
            )
          : command.predicate,
      )
      .sort((a, b) => a.order - b.order);

    if (!commandSearch) {
      setCommandsByCategory(getNextCommandsByCategory(matchingCommands));
      setCurrentOption(null);
      return;
    }

    matchingCommands = matchingCommands.filter((item) => {
      return item.name.toLowerCase().includes(commandSearch.toLowerCase());
    });

    setCommandsByCategory(getNextCommandsByCategory(matchingCommands));
    setCurrentOption(matchingCommands[0]);
  }, [commandSearch, appState, allCommands, appProps, app]);

  return (
    <Dialog
      onCloseRequest={() => closeCommandPalette()}
      closeOnClickOutside
      title={t("commandPalette.title")}
      size={"small"}
      autofocus
    >
      <div className="CommandPalette">
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
          <CommandShortcutHint shortcut="↵" className="margin-left">
            {t("commandPalette.shortcuts.execute")}
          </CommandShortcutHint>
          <CommandShortcutHint shortcut="⌘+P" className="margin-left">
            {t("commandPalette.shortcuts.close")}
          </CommandShortcutHint>
        </div>

        <div className="commands">
          {Object.keys(commandsByCategory).map((category, idx) => {
            const totalCategories = Object.keys(commandsByCategory).length;
            return (
              <div
                className={clsx("command-category", {
                  "border-bottom": idx !== totalCategories - 1,
                })}
                key={category}
              >
                <div className="command-category-title">{category}</div>
                {commandsByCategory[category].map((command) => (
                  <div
                    key={command.name as string}
                    className={clsx("command-item", {
                      "selected-item": currentOption?.name === command.name,
                    })}
                    ref={(ref) => {
                      if (currentOption?.name === command.name) {
                        ref?.scrollIntoView?.({
                          block: "nearest",
                        });
                      }
                    }}
                    onPointerDown={() => {
                      executeCommand(command);
                    }}
                  >
                    {command.name}
                    {command.shortcut && (
                      <CommandShortcutHint
                        shortcut={command.shortcut}
                        selected={currentOption?.name === command.name}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
