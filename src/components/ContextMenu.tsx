import { createRoot, Root } from "react-dom/client";
import clsx from "clsx";
import { Popover } from "./Popover";
import { t } from "../i18n";

import "./ContextMenu.scss";
import {
  getShortcutFromShortcutName,
  ShortcutName,
} from "../actions/shortcuts";
import { Action } from "../actions/types";
import { ActionManager } from "../actions/manager";
import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "../element/types";

export type ContextMenuOption = "separator" | Action;

type ContextMenuProps = {
  options: ContextMenuOption[];
  onCloseRequest?(): void;
  top: number;
  left: number;
  actionManager: ActionManager;
  appState: Readonly<AppState>;
  elements: readonly NonDeletedExcalidrawElement[];
};

const ContextMenu = ({
  options,
  onCloseRequest,
  top,
  left,
  actionManager,
  appState,
  elements,
}: ContextMenuProps) => {
  return (
    <Popover
      onCloseRequest={onCloseRequest}
      top={top}
      left={left}
      fitInViewport={true}
      offsetLeft={appState.offsetLeft}
      offsetTop={appState.offsetTop}
      viewportWidth={appState.width}
      viewportHeight={appState.height}
    >
      <ul
        className="context-menu"
        onContextMenu={(event) => event.preventDefault()}
      >
        {options.map((option, idx) => {
          if (option === "separator") {
            return <hr key={idx} className="context-menu-option-separator" />;
          }

          const actionName = option.name;
          let label = "";
          if (option.contextItemLabel) {
            if (typeof option.contextItemLabel === "function") {
              label = t(option.contextItemLabel(elements, appState));
            } else {
              label = t(option.contextItemLabel);
            }
          }
          return (
            <li key={idx} data-testid={actionName} onClick={onCloseRequest}>
              <button
                className={clsx("context-menu-option", {
                  dangerous: actionName === "deleteSelectedElements",
                  checkmark: option.checked?.(appState),
                })}
                onClick={() =>
                  actionManager.executeAction(option, "contextMenu")
                }
              >
                <div className="context-menu-option__label">{label}</div>
                <kbd className="context-menu-option__shortcut">
                  {actionName
                    ? getShortcutFromShortcutName(actionName as ShortcutName)
                    : ""}
                </kbd>
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
};

const contextMenuRoots = new WeakMap<HTMLElement, Root>();

const getContextMenuRoot = (container: HTMLElement): Root => {
  let contextMenuRoot = contextMenuRoots.get(container);
  if (contextMenuRoot) {
    return contextMenuRoot;
  }
  contextMenuRoot = createRoot(
    container.querySelector(".excalidraw-contextMenuContainer")!,
  );
  contextMenuRoots.set(container, contextMenuRoot);
  return contextMenuRoot;
};

const handleClose = (container: HTMLElement) => {
  const contextMenuRoot = contextMenuRoots.get(container);
  if (contextMenuRoot) {
    contextMenuRoot.unmount();
    contextMenuRoots.delete(container);
  }
};

export default {
  push(params: {
    options: (ContextMenuOption | false | null | undefined)[];
    top: ContextMenuProps["top"];
    left: ContextMenuProps["left"];
    actionManager: ContextMenuProps["actionManager"];
    appState: Readonly<AppState>;
    container: HTMLElement;
    elements: readonly NonDeletedExcalidrawElement[];
  }) {
    const options = Array.of<ContextMenuOption>();
    params.options.forEach((option) => {
      if (option) {
        options.push(option);
      }
    });
    if (options.length) {
      getContextMenuRoot(params.container).render(
        <ContextMenu
          top={params.top}
          left={params.left}
          options={options}
          onCloseRequest={() => handleClose(params.container)}
          actionManager={params.actionManager}
          appState={params.appState}
          elements={params.elements}
        />,
      );
    }
  },
};
