import { useMemo } from "react";

import { DEFAULT_SIDEBAR, KEYS, capitalizeString } from "@excalidraw/common";

import { actionToggleShapeSwitch } from "@excalidraw/excalidraw/actions/actionToggleShapeSwitch";

import type { ActionManager } from "@excalidraw/excalidraw/actions/manager";

import type { MarkRequired } from "@excalidraw/common/utility-types";

import {
  actionClearCanvas,
  actionLink,
  actionToggleSearchMenu,
} from "../../../actions";
import { DEFAULT_CATEGORIES, CATEGORIES_ORDER } from "../constants/categories";
import {
  actionCopyElementLink,
  actionLinkToElement,
} from "../../../actions/actionElementLink";
import { getShortcutFromShortcutName } from "../../../actions/shortcuts";
import { useUIAppState } from "../../../context/ui-appState";
import { deburr } from "../../../deburr";
import { editorJotaiStore } from "../../../editor-jotai";
import { t } from "../../../i18n";
import {
  useApp,
  useAppProps,
  useExcalidrawActionManager,
  useExcalidrawSetAppState,
} from "../../App";
import { getSelectedElements } from "../../../scene";
import {
  LockedIcon,
  UnlockedIcon,
  searchIcon,
  boltIcon,
  bucketFillIcon,
  ExportImageIcon,
  mermaidLogoIcon,
  brainIconThin,
  LibraryIcon,
} from "../../icons";

import { SHAPES } from "../../shapes";
import { canChangeBackgroundColor, canChangeStrokeColor } from "../../Actions";
import { activeConfirmDialogAtom } from "../../ActiveConfirmDialog";
import { useStable } from "../../../hooks/useStable";

import type { CommandPaletteItem } from "../types";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../../../types";
import type { ShortcutName } from "../../../actions/shortcuts";
import type { TranslationKeys } from "../../../i18n";
import type { Action } from "../../../actions/types";

const getCategoryOrder = (category: string) => {
  if (category in CATEGORIES_ORDER) {
    return CATEGORIES_ORDER[category];
  }

  return 10;
};

const getActionLabel = (
  action: Action,
  { app, uiAppState }: { app: AppClassProperties; uiAppState: UIAppState },
) => {
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

const getActionIcon = (
  action: Action,
  { app, uiAppState }: { app: AppClassProperties; uiAppState: UIAppState },
) => {
  if (typeof action.icon === "function") {
    return action.icon(uiAppState, app.scene.getNonDeletedElements());
  }
  return action.icon;
};

const actionToCommand = (
  action: Action,
  category: string,
  {
    app,
    uiAppState,
    actionManager,
  }: {
    app: AppClassProperties;
    uiAppState: UIAppState;
    actionManager: ActionManager;
  },
  transformer?: (
    command: CommandPaletteItem,
    action: Action,
  ) => CommandPaletteItem,
): CommandPaletteItem => {
  const command: CommandPaletteItem = {
    label: getActionLabel(action, { app, uiAppState }),
    icon: getActionIcon(action, { app, uiAppState }),
    category,
    shortcut: getShortcutFromShortcutName(action.name as ShortcutName),
    keywords: action.keywords,
    predicate: action.predicate,
    viewMode: action.viewMode,
    perform: () => {
      actionManager.executeAction(action, "commandPalette");
    },
  };

  return transformer ? transformer(command, action) : command;
};

const getElementsCommands = ({
  app,
  uiAppState,
  actionManager,
}: {
  app: AppClassProperties;
  uiAppState: UIAppState;
  actionManager: ActionManager;
}): CommandPaletteItem[] => {
  return [
    actionManager.actions.group,
    actionManager.actions.ungroup,
    actionManager.actions.cut,
    actionManager.actions.copy,
    actionManager.actions.deleteSelectedElements,
    actionManager.actions.wrapSelectionInFrame,
    actionManager.actions.copyStyles,
    actionManager.actions.pasteStyles,
    actionManager.actions.bringToFront,
    actionManager.actions.bringForward,
    actionManager.actions.sendBackward,
    actionManager.actions.sendToBack,
    actionManager.actions.alignTop,
    actionManager.actions.alignBottom,
    actionManager.actions.alignLeft,
    actionManager.actions.alignRight,
    actionManager.actions.alignVerticallyCentered,
    actionManager.actions.alignHorizontallyCentered,
    actionManager.actions.duplicateSelection,
    actionManager.actions.flipHorizontal,
    actionManager.actions.flipVertical,
    actionManager.actions.zoomToFitSelection,
    actionManager.actions.zoomToFitSelectionInViewport,
    actionManager.actions.increaseFontSize,
    actionManager.actions.decreaseFontSize,
    actionManager.actions.toggleLinearEditor,
    actionManager.actions.cropEditor,
    actionManager.actions.togglePolygon,
    actionLink,
    actionCopyElementLink,
    actionLinkToElement,
  ].map((action: Action) =>
    actionToCommand(
      action,
      DEFAULT_CATEGORIES.elements,
      { app, uiAppState, actionManager },
      (command, action) => ({
        ...command,
        predicate: action.predicate
          ? action.predicate
          : (elements, appState) => {
              const selectedElements = getSelectedElements(elements, appState);
              return selectedElements.length > 0;
            },
      }),
    ),
  );
};

const getToolCommands = ({
  app,
  uiAppState,
  actionManager,
}: {
  app: AppClassProperties;
  uiAppState: UIAppState;
  actionManager: ActionManager;
}): CommandPaletteItem[] => {
  return [
    actionManager.actions.toggleHandTool,
    actionManager.actions.setFrameAsActiveTool,
    actionManager.actions.toggleLassoTool,
  ].map((action) =>
    actionToCommand(action, DEFAULT_CATEGORIES.tools, {
      app,
      uiAppState,
      actionManager,
    }),
  );
};

const getEditorCommands = ({
  app,
  uiAppState,
  actionManager,
}: {
  app: AppClassProperties;
  uiAppState: UIAppState;
  actionManager: ActionManager;
}): CommandPaletteItem[] => {
  return [
    actionManager.actions.undo,
    actionManager.actions.redo,
    actionManager.actions.zoomIn,
    actionManager.actions.zoomOut,
    actionManager.actions.resetZoom,
    actionManager.actions.zoomToFit,
    actionManager.actions.zenMode,
    actionManager.actions.viewMode,
    actionManager.actions.gridMode,
    actionManager.actions.objectsSnapMode,
    actionManager.actions.toggleShortcuts,
    actionManager.actions.selectAll,
    actionManager.actions.toggleElementLock,
    actionManager.actions.unlockAllElements,
    actionManager.actions.stats,
  ].map((action) =>
    actionToCommand(action, DEFAULT_CATEGORIES.editor, {
      app,
      uiAppState,
      actionManager,
    }),
  );
};

const getExportCommands = ({
  app,
  uiAppState,
  actionManager,
}: {
  app: AppClassProperties;
  uiAppState: UIAppState;
  actionManager: ActionManager;
}): CommandPaletteItem[] => {
  return [
    actionManager.actions.saveToActiveFile,
    actionManager.actions.saveFileToDisk,
    actionManager.actions.copyAsPng,
    actionManager.actions.copyAsSvg,
  ].map((action) =>
    actionToCommand(action, DEFAULT_CATEGORIES.export, {
      app,
      uiAppState,
      actionManager,
    }),
  );
};

const getShapeCommands = ({
  app,
  appProps,
}: {
  app: AppClassProperties;
  appProps: AppProps;
}): CommandPaletteItem[] => {
  return SHAPES.reduce((acc: CommandPaletteItem[], shape) => {
    const { value, icon, key, numericKey } = shape;

    if (
      appProps.UIOptions.tools?.[
        value as Extract<typeof value, keyof AppProps["UIOptions"]["tools"]>
      ] === false
    ) {
      return acc;
    }

    const letter =
      key && capitalizeString(typeof key === "string" ? key : key[0]);
    const shortcut = letter || numericKey;

    const command: CommandPaletteItem = {
      label: t(`toolBar.${value}`),
      category: DEFAULT_CATEGORIES.tools,
      shortcut,
      icon,
      keywords: ["toolbar"],
      viewMode: false,
      perform: () => {
        if (value === "image") {
          app.setActiveTool({
            type: value,
          });
        } else {
          app.setActiveTool({ type: value });
        }
      },
    };

    acc.push(command);

    return acc;
  }, []);
};

export const useAllCommands = (
  customCommandPaletteItems?: CommandPaletteItem[],
): MarkRequired<CommandPaletteItem, "haystack" | "order">[] => {
  const app = useApp();
  const appProps = useAppProps();
  const uiAppState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const actionManager = useExcalidrawActionManager();

  const stableDeps = useStable({
    uiAppState,
    customCommandPaletteItems,
    appProps,
  });

  return useMemo(() => {
    // these props change often and we don't want them to re-run the effect
    // which would renew `allCommands`, cascading down and resetting state.
    //
    // This means that the commands won't update on appState/appProps changes
    // while the command palette is open
    const { uiAppState, customCommandPaletteItems, appProps } = stableDeps;

    const commandsFromActions: CommandPaletteItem[] = [
      ...getElementsCommands({ app, uiAppState, actionManager }),
      ...getEditorCommands({ app, uiAppState, actionManager }),
      {
        label: getActionLabel(actionClearCanvas, { app, uiAppState }),
        icon: getActionIcon(actionClearCanvas, { app, uiAppState }),
        shortcut: getShortcutFromShortcutName(
          actionClearCanvas.name as ShortcutName,
        ),
        category: DEFAULT_CATEGORIES.editor,
        keywords: ["delete", "destroy"],
        viewMode: false,
        perform: () => {
          editorJotaiStore.set(activeConfirmDialogAtom, "clearCanvas");
        },
      },
      {
        label: t("buttons.exportImage"),
        category: DEFAULT_CATEGORIES.export,
        icon: ExportImageIcon,
        shortcut: getShortcutFromShortcutName("imageExport"),
        keywords: [
          "export",
          "image",
          "png",
          "jpeg",
          "svg",
          "clipboard",
          "picture",
        ],
        perform: () => {
          setAppState({ openDialog: { name: "imageExport" } });
        },
      },
      ...getExportCommands({ app, uiAppState, actionManager }),
    ];

    const additionalCommands: CommandPaletteItem[] = [
      {
        label: t("toolBar.library"),
        category: DEFAULT_CATEGORIES.app,
        icon: LibraryIcon,
        viewMode: false,
        perform: () => {
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
        label: t("search.title"),
        category: DEFAULT_CATEGORIES.app,
        icon: searchIcon,
        viewMode: true,
        perform: () => {
          actionManager.executeAction(actionToggleSearchMenu);
        },
      },
      {
        label: t("labels.shapeSwitch"),
        category: DEFAULT_CATEGORIES.elements,
        icon: boltIcon,
        perform: () => {
          actionManager.executeAction(actionToggleShapeSwitch);
        },
      },
      {
        label: t("labels.changeStroke"),
        keywords: ["color", "outline"],
        category: DEFAULT_CATEGORIES.elements,
        icon: bucketFillIcon,
        viewMode: false,
        predicate: (elements, appState) => {
          const selectedElements = getSelectedElements(elements, appState);
          return (
            selectedElements.length > 0 &&
            canChangeStrokeColor(appState, selectedElements)
          );
        },
        perform: () => {
          setAppState((prevState) => ({
            openMenu: prevState.openMenu === "shape" ? null : "shape",
            openPopup: "elementStroke",
          }));
        },
      },
      {
        label: t("labels.changeBackground"),
        keywords: ["color", "fill"],
        icon: bucketFillIcon,
        category: DEFAULT_CATEGORIES.elements,
        viewMode: false,
        predicate: (elements, appState) => {
          const selectedElements = getSelectedElements(elements, appState);
          return (
            selectedElements.length > 0 &&
            canChangeBackgroundColor(appState, selectedElements)
          );
        },
        perform: () => {
          setAppState((prevState) => ({
            openMenu: prevState.openMenu === "shape" ? null : "shape",
            openPopup: "elementBackground",
          }));
        },
      },
      {
        label: t("labels.canvasBackground"),
        keywords: ["color"],
        icon: bucketFillIcon,
        category: DEFAULT_CATEGORIES.editor,
        viewMode: false,
        perform: () => {
          setAppState((prevState) => ({
            openMenu: prevState.openMenu === "canvas" ? null : "canvas",
            openPopup: "canvasBackground",
          }));
        },
      },
      ...getShapeCommands({ app, appProps }),
      ...getToolCommands({ app, uiAppState, actionManager }),
      {
        label: t("toolBar.lock"),
        category: DEFAULT_CATEGORIES.tools,
        icon: uiAppState.activeTool.locked ? LockedIcon : UnlockedIcon,
        shortcut: KEYS.Q.toLocaleUpperCase(),
        viewMode: false,
        perform: () => {
          app.toggleLock();
        },
      },
      {
        label: `${t("labels.textToDiagram")}...`,
        category: DEFAULT_CATEGORIES.tools,
        icon: brainIconThin,
        viewMode: false,
        predicate: appProps.aiEnabled,
        perform: () => {
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
        label: `${t("toolBar.mermaidToExcalidraw")}...`,
        category: DEFAULT_CATEGORIES.tools,
        icon: mermaidLogoIcon,
        viewMode: false,
        predicate: appProps.aiEnabled,
        perform: () => {
          setAppState((state) => ({
            ...state,
            openDialog: {
              name: "ttd",
              tab: "mermaid",
            },
          }));
        },
      },
      // {
      //   label: `${t("toolBar.magicframe")}...`,
      //   category: DEFAULT_CATEGORIES.tools,
      //   icon: MagicIconThin,
      //   viewMode: false,
      //   predicate: appProps.aiEnabled,
      //   perform: () => {
      //     app.onMagicframeToolSelect();
      //   },
      // },
    ];

    const allCommands = [
      ...commandsFromActions,
      ...additionalCommands,
      ...(customCommandPaletteItems || []),
    ].map((command) => {
      return {
        ...command,
        icon: command.icon || boltIcon,
        order: command.order ?? getCategoryOrder(command.category),
        haystack: `${deburr(command.label.toLocaleLowerCase())} ${
          command.keywords?.join(" ") || ""
        }`,
      };
    });

    return allCommands;
  }, [stableDeps, actionManager, app, setAppState]);
};
