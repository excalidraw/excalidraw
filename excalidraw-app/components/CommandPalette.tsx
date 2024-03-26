import { useCallback, useEffect, useState } from "react";
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
  LockedIcon,
  UnlockedIcon,
  clockIcon,
  searchIcon,
  boltIcon,
} from "../../packages/excalidraw/components/icons";
import fuzzy from "fuzzy";
import { useUIAppState } from "../../packages/excalidraw/context/ui-appState";
import { AppProps, AppState } from "../../packages/excalidraw/types";
import {
  capitalizeString,
  getShortcutKey,
} from "../../packages/excalidraw/utils";
import { atom, useAtom } from "jotai";
import { deburr } from "../../packages/excalidraw/deburr";

import "./CommandPalette.scss";
import { MarkRequired } from "../../packages/excalidraw/utility-types";
import { InlineIcon } from "../../packages/excalidraw/components/InlineIcon";
import { SHAPES } from "../../packages/excalidraw/shapes";
import {
  canChangeBackgroundColor,
  canChangeStrokeColor,
} from "../../packages/excalidraw/components/Actions";

const escapeHTMLAngleBrackets = (str: string) => {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

// used to demarcate command name from keywords so we can strip on render
const KEYWORDS_SEPARATOR = "|||";

export type CommandPaletteItem = {
  name: string;
  /** additional keywords to match against
   * (appended to haystack, not displayed) */
  keywords?: string[];
  /**
   * string we should match against when searching
   * (deburred name + keywords)
   */
  haystack?: string;
  icon?: React.ReactNode;
  category: string;
  order: number;
  predicate?: boolean | Action["predicate"];
  shortcut?: string;
  execute: (
    event: React.MouseEvent | React.KeyboardEvent | KeyboardEvent,
  ) => void;
  /** when fuzzy matched, we wrap matched bits of the name in <b> and </b> to highlight
   *  and fuzzyName is the result string
   */
  _fuzzyName?: string;
};

export const lastUsedPaletteItem = atom<CommandPaletteItem | null>(null);

export const DEFAULT_CATEGORIES = {
  app: "App",
  export: "Export",
  tools: "Tools",
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
    case DEFAULT_CATEGORIES.tools:
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

export const CommandPalette = (props: CommandPaletteProps) => {
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
};

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
    if (!uiAppState || !app.scene || !actionManager) {
      return;
    }
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
      ].map((action) => ({
        name: getActionLabel(action),
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        category: DEFAULT_CATEGORIES.tools,
        order: getCategoryOrder(DEFAULT_CATEGORIES.tools),
        predicate: action.predicate,
        keywords: action.keywords,
        icon: action.icon,
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
        actionManager.actions.selectAll,
        actionManager.actions.toggleElementLock,
        actionManager.actions.unlockAllElements,
        actionManager.actions.stats,
      ].map((action) => ({
        name: getActionLabel(action),
        keywords: action.keywords,
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        category: DEFAULT_CATEGORIES.editor,
        predicate: action.predicate,
        order: getCategoryOrder(DEFAULT_CATEGORIES.editor),
        execute: () => actionManager.executeAction(action, "commandPalette"),
      }));

      const exportCommands: CommandPaletteItem[] = [
        actionManager.actions.saveToActiveFile,
        actionManager.actions.saveFileToDisk,
        actionManager.actions.copyAsPng,
        actionManager.actions.copyAsSvg,
      ].map((action) => ({
        name: getActionLabel(action),
        shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
        category: DEFAULT_CATEGORIES.export,
        order: getCategoryOrder(DEFAULT_CATEGORIES.export),
        predicate: action.predicate,
        keywords: action.keywords,
        execute: () => actionManager.executeAction(action, "commandPalette"),
      }));

      commandsFromActions = [
        ...elementsCommands,
        ...editorCommands,
        {
          name: `${t("overwriteConfirm.action.exportToImage.title")}...`,
          category: DEFAULT_CATEGORIES.export,
          shortcut: getShortcutFromShortcutName("imageExport"),
          order: getCategoryOrder(DEFAULT_CATEGORIES.export),
          keywords: [
            "export",
            "image",
            "png",
            "jpeg",
            "svg",
            "clipboard",
            "picture",
          ],
          execute: () => {
            setAppState({ openDialog: { name: "imageExport" } });
          },
        },
        ...exportCommands,
      ];

      const additionalCommands: CommandPaletteItem[] = [
        {
          name: t("labels.excalidrawLib"),
          category: DEFAULT_CATEGORIES.app,
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
          name: t("labels.stroke"),
          category: DEFAULT_CATEGORIES.elements,
          predicate: (elements, appState) => {
            const selectedElements = getSelectedElements(elements, appState);
            return (
              selectedElements.length > 0 &&
              canChangeStrokeColor(appState, selectedElements)
            );
          },
          order: getCategoryOrder(DEFAULT_CATEGORIES.elements),
          execute: () => {
            setAppState((prevState) => ({
              openMenu: prevState.openMenu === "shape" ? null : "shape",
              openPopup: "elementStroke",
            }));
          },
        },
        {
          name: t("labels.background"),
          category: DEFAULT_CATEGORIES.elements,
          predicate: (elements, appState) => {
            const selectedElements = getSelectedElements(elements, appState);
            return (
              selectedElements.length > 0 &&
              canChangeBackgroundColor(appState, selectedElements)
            );
          },
          order: getCategoryOrder(DEFAULT_CATEGORIES.elements),
          execute: () => {
            setAppState((prevState) => ({
              openMenu: prevState.openMenu === "shape" ? null : "shape",
              openPopup: "elementBackground",
            }));
          },
        },
        {
          name: t("labels.canvasBackground"),
          category: DEFAULT_CATEGORIES.editor,
          order: getCategoryOrder(DEFAULT_CATEGORIES.editor),
          execute: () => {
            setAppState((prevState) => ({
              openMenu: prevState.openMenu === "canvas" ? null : "canvas",
              openPopup: "canvasBackground",
            }));
          },
        },
        ...SHAPES.reduce((acc: CommandPaletteItem[], shape) => {
          const { value, icon, key, numericKey } = shape;

          if (
            appProps.UIOptions.tools?.[
              value as Extract<
                typeof value,
                keyof AppProps["UIOptions"]["tools"]
              >
            ] === false
          ) {
            return acc;
          }

          const letter =
            key && capitalizeString(typeof key === "string" ? key : key[0]);
          const shortcut = letter || numericKey;

          const command: CommandPaletteItem = {
            name: t(`toolBar.${value}`),
            category: DEFAULT_CATEGORIES.tools,
            order: getCategoryOrder(DEFAULT_CATEGORIES.tools),
            shortcut,
            icon,
            keywords: ["toolbar"],
            execute: (event) => {
              if (value === "image") {
                app.setActiveTool({
                  type: value,
                  insertOnCanvasDirectly: event.type === EVENT.KEYDOWN,
                });
              } else {
                app.setActiveTool({ type: value });
              }
            },
          };

          acc.push(command);

          return acc;
        }, []),
        ...toolCommands,
        {
          name: t("toolBar.lock"),
          category: DEFAULT_CATEGORIES.tools,
          icon: uiAppState.activeTool.locked ? LockedIcon : UnlockedIcon,
          order: getCategoryOrder(DEFAULT_CATEGORIES.tools),
          shortcut: KEYS.Q.toLocaleUpperCase(),
          execute: () => {
            app.toggleLock();
          },
        },
        {
          name: `${t("labels.textToDiagram")}...`,
          category: DEFAULT_CATEGORIES.tools,
          order: getCategoryOrder(DEFAULT_CATEGORIES.tools),
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
          category: DEFAULT_CATEGORIES.tools,
          predicate: appProps.aiEnabled,
          order: getCategoryOrder(DEFAULT_CATEGORIES.tools),
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
          category: DEFAULT_CATEGORIES.tools,
          order: getCategoryOrder(DEFAULT_CATEGORIES.tools),
          predicate: appProps.aiEnabled,
          execute: () => {
            app.onMagicframeToolSelect();
          },
        },
      ];

      const allCommands = [
        ...commandsFromActions,
        ...additionalCommands,
        ...customCommandPaletteItems,
      ].map((command) => {
        const sanitizedName = escapeHTMLAngleBrackets(command.name);
        return {
          ...command,
          icon: command.icon || boltIcon,
          name: sanitizedName,
          haystack: `${deburr(sanitizedName)}${KEYWORDS_SEPARATOR}${
            command.keywords?.join(" ") || ""
          }`,
        };
      });

      setAllCommands(allCommands);
      setLastUsed(
        allCommands.find((command) => command.name === lastUsed?.name) ?? null,
      );
    }
  }, [
    app,
    appProps,
    uiAppState,
    actionManager,
    setAllCommands,
    lastUsed?.name,
    setLastUsed,
    setAppState,
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

  const executeCommand = (
    command: CommandPaletteItem,
    event: React.MouseEvent | React.KeyboardEvent | KeyboardEvent,
  ) => {
    if (uiAppState.openDialog?.name === "commandPalette") {
      document.body.classList.add("excalidraw-animations-disabled");
      closeCommandPalette(() => {
        command.execute(event);
        setLastUsed(command);

        requestAnimationFrame(() => {
          document.body.classList.remove("excalidraw-animations-disabled");
        });
      });
    }
  };

  const isCommandAvailable = useCallback(
    (command: CommandPaletteItem) => {
      return typeof command.predicate === "function"
        ? command.predicate(
            app.scene.getNonDeletedElements(),
            uiAppState as AppState,
            appProps,
            app,
          )
        : command.predicate === undefined || command.predicate;
    },
    [app, appProps, uiAppState],
  );

  const handleKeyDown = (event: React.KeyboardEvent | KeyboardEvent) => {
    const matchingCommands = Object.values(commandsByCategory).flat();
    const shouldConsiderLastUsed =
      lastUsed && !commandSearch && isCommandAvailable(lastUsed);

    if (event.key === KEYS.ARROW_UP) {
      event.preventDefault();
      const index = matchingCommands.findIndex(
        (item) => item.name === currentCommand?.name,
      );

      if (shouldConsiderLastUsed) {
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

      if (shouldConsiderLastUsed) {
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
        executeCommand(currentCommand, event);
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
      .filter(isCommandAvailable)
      .sort((a, b) => a.order - b.order);

    const shouldConsiderLastUsed =
      !commandSearch && lastUsed && isCommandAvailable(lastUsed);

    if (!commandSearch) {
      setCommandsByCategory(
        getNextCommandsByCategory(
          shouldConsiderLastUsed
            ? matchingCommands.filter(
                (command) => command.name !== lastUsed?.name,
              )
            : matchingCommands,
        ),
      );
      setCurrentCommand(null);
      return;
    }

    const _query = deburr(commandSearch.replace(/[<>-_| ]/g, ""));
    matchingCommands = fuzzy
      .filter(_query, matchingCommands, {
        extract: (command) => command.haystack,
        pre: "<b>",
        post: "</b>",
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        ...item.original,
        _fuzzyName: item.string,
      }));

    setCommandsByCategory(getNextCommandsByCategory(matchingCommands));
    setCurrentCommand(matchingCommands[0]);
  }, [commandSearch, allCommands, isCommandAvailable, lastUsed]);

  return (
    <Dialog
      onCloseRequest={() => closeCommandPalette()}
      closeOnClickOutside
      title={false}
      size={720}
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

      {!app.device.viewport.isMobile && (
        <div className="shortcuts-wrapper">
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
              onClick={(event) => executeCommand(lastUsed, event)}
              disabled={!isCommandAvailable(lastUsed)}
              onMouseMove={() => setCurrentCommand(lastUsed)}
              showShortcut={!app.device.viewport.isMobile}
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
                    onClick={(event) => executeCommand(command, event)}
                    onMouseMove={() => setCurrentCommand(command)}
                    showShortcut={!app.device.viewport.isMobile}
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
  disabled,
  onMouseMove,
  onClick,
  showShortcut,
}: {
  command: CommandPaletteItem;
  isSelected: boolean;
  disabled?: boolean;
  onMouseMove: () => void;
  onClick: (event: React.MouseEvent) => void;
  showShortcut: boolean;
}) => {
  const noop = () => {};

  return (
    <div
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
    >
      <div className="name">
        {command.icon && <InlineIcon icon={command.icon} />}
        <div
          dangerouslySetInnerHTML={{
            __html: (command._fuzzyName ?? command.name).split(
              KEYWORDS_SEPARATOR,
            )[0],
          }}
        />
      </div>
      {showShortcut && command.shortcut && (
        <CommandShortcutHint shortcut={command.shortcut} />
      )}
    </div>
  );
};
