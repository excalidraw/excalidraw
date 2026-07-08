import clsx from "clsx";
import React, { useEffect, useRef } from "react";

import { KEYS } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";

import { useExcalidrawAppState, useExcalidrawElements } from "./App";

import { Popover } from "./Popover";

import "./ContextMenu.scss";

import type { ActionManager } from "../actions/manager";
import type { ShortcutName } from "../actions/shortcuts";
import type { Action } from "../actions/types";

import type { TranslationKeys } from "../i18n";

export type ContextMenuItem = typeof CONTEXT_MENU_SEPARATOR | Action;

export type ContextMenuItems = (ContextMenuItem | false | null | undefined)[];

type ContextMenuProps = {
  actionManager: ActionManager;
  items: ContextMenuItems;
  top: number;
  left: number;
  onClose: (callback?: () => void) => void;
};

export const CONTEXT_MENU_SEPARATOR = "separator";

export const ContextMenu = React.memo(
  ({ actionManager, items, top, left, onClose }: ContextMenuProps) => {
    const appState = useExcalidrawAppState();
    const elements = useExcalidrawElements();
    const menuRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("button.context-menu-item")
        ?.focus();
    }, []);

    const getMenuItems = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          "button.context-menu-item",
        ) ?? [],
      );

    const handleMenuKeyDown = (event: React.KeyboardEvent) => {
      const menuItems = getMenuItems();
      if (!menuItems.length) {
        return;
      }
      const currentIndex = menuItems.indexOf(
        document.activeElement as HTMLButtonElement,
      );

      let nextIndex = -1;
      if (event.key === KEYS.ARROW_DOWN) {
        nextIndex =
          currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
      } else if (event.key === KEYS.ARROW_UP) {
        nextIndex =
          currentIndex < 0
            ? menuItems.length - 1
            : (currentIndex - 1 + menuItems.length) % menuItems.length;
      } else if (event.key === KEYS.HOME) {
        nextIndex = 0;
      } else if (event.key === KEYS.END) {
        nextIndex = menuItems.length - 1;
      } else if (event.key === KEYS.ESCAPE || event.key === KEYS.TAB) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (nextIndex > -1) {
        event.preventDefault();
        event.stopPropagation();
        menuItems[nextIndex].focus();
      }
    };

    const filteredItems = items.reduce((acc: ContextMenuItem[], item) => {
      if (
        item &&
        (item === CONTEXT_MENU_SEPARATOR ||
          !item.predicate ||
          item.predicate(
            elements,
            appState,
            actionManager.app.props,
            actionManager.app,
          ))
      ) {
        acc.push(item);
      }
      return acc;
    }, []);

    return (
      <Popover
        onCloseRequest={() => {
          onClose();
        }}
        top={top}
        left={left}
        fitInViewport={true}
        offsetLeft={appState.offsetLeft}
        offsetTop={appState.offsetTop}
        viewportWidth={appState.width}
        viewportHeight={appState.height}
        className="context-menu-popover"
      >
        <ul
          className="context-menu"
          role="menu"
          aria-label={t("labels.contextMenu")}
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
          onContextMenu={(event) => event.preventDefault()}
        >
          {filteredItems.map((item, idx) => {
            if (item === CONTEXT_MENU_SEPARATOR) {
              if (
                !filteredItems[idx - 1] ||
                filteredItems[idx - 1] === CONTEXT_MENU_SEPARATOR
              ) {
                return null;
              }
              return <hr key={idx} className="context-menu-item-separator" />;
            }

            const actionName = item.name;
            let label = "";
            if (item.label) {
              if (typeof item.label === "function") {
                label = t(
                  item.label(
                    elements,
                    appState,
                    actionManager.app,
                  ) as unknown as TranslationKeys,
                );
              } else {
                label = t(item.label as unknown as TranslationKeys);
              }
            }

            return (
              <li
                key={idx}
                role="none"
                data-testid={actionName}
                onClick={() => {
                  // we need update state before executing the action in case
                  // the action uses the appState it's being passed (that still
                  // contains a defined contextMenu) to return the next state.
                  onClose(() => {
                    actionManager.executeAction(item, "contextMenu");
                  });
                }}
              >
                <button
                  type="button"
                  role={item.checked ? "menuitemcheckbox" : "menuitem"}
                  aria-checked={
                    item.checked ? item.checked(appState) : undefined
                  }
                  tabIndex={-1}
                  className={clsx("context-menu-item", {
                    dangerous: actionName === "deleteSelectedElements",
                    checkmark: item.checked?.(appState),
                  })}
                >
                  <div className="context-menu-item__label">{label}</div>
                  <kbd className="context-menu-item__shortcut">
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
  },
);
