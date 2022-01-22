import { render, unmountComponentAtNode } from "react-dom";
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

export type ContextMenuOption = "separator" | Action;

type ContextMenuProps = {
  options: ContextMenuOption[];
  onCloseRequest?(): void;
  top: number;
  left: number;
  actionManager: ActionManager;
  appState: Readonly<AppState>;
};

const ContextMenu = ({
  options,
  onCloseRequest,
  top,
  left,
  actionManager,
  appState,
}: ContextMenuProps) => {
  return (
    <Popover
      onCloseRequest={onCloseRequest}
      top={top}
      left={left}
      fitInViewport={true}
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
          const label = option.contextItemLabel
            ? t(option.contextItemLabel)
            : "";
          return (
            <li key={idx} data-testid={actionName} onClick={onCloseRequest}>
              <button
                className={clsx("context-menu-option", {
                  dangerous: actionName === "deleteSelectedElements",
                  checkmark: option.checked?.(appState),
                })}
                onClick={() => actionManager.executeAction(option)}
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

const contextMenuNodeByContainer = new WeakMap<HTMLElement, HTMLDivElement>();

const getContextMenuNode = (container: HTMLElement): HTMLDivElement => {
  let contextMenuNode = contextMenuNodeByContainer.get(container);
  if (contextMenuNode) {
    return contextMenuNode;
  }
  contextMenuNode = document.createElement("div");
  container
    .querySelector(".excalidraw-contextMenuContainer")!
    .appendChild(contextMenuNode);
  contextMenuNodeByContainer.set(container, contextMenuNode);
  return contextMenuNode;
};

type ContextMenuParams = {
  options: (ContextMenuOption | false | null | undefined)[];
  top: ContextMenuProps["top"];
  left: ContextMenuProps["left"];
  actionManager: ContextMenuProps["actionManager"];
  appState: Readonly<AppState>;
  container: HTMLElement;
};

const handleClose = (container: HTMLElement) => {
  const contextMenuNode = contextMenuNodeByContainer.get(container);
  if (contextMenuNode) {
    unmountComponentAtNode(contextMenuNode);
    contextMenuNode.remove();
    contextMenuNodeByContainer.delete(container);
  }
};

export default {
  push(params: ContextMenuParams) {
    const options = Array.of<ContextMenuOption>();
    params.options.forEach((option) => {
      if (option) {
        options.push(option);
      }
    });
    if (options.length) {
      render(
        <ContextMenu
          top={params.top}
          left={params.left}
          options={options}
          onCloseRequest={() => handleClose(params.container)}
          actionManager={params.actionManager}
          appState={params.appState}
        />,
        getContextMenuNode(params.container),
      );
    }
  },
};
