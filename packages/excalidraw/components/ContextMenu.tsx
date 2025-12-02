import clsx from "clsx";
import React, { useState } from "react";

import type { Layer, LayerId } from "@excalidraw/element/types";

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

/**
 * Submenu component for moving elements to a different layer.
 */
const MoveToLayerSubmenu = ({
  layers,
  onSelect,
  onClose,
}: {
  layers: readonly Layer[];
  onSelect: (layerId: LayerId) => void;
  onClose: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Sort layers by order (higher order = top of list)
  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  return (
    <li
      className="context-menu-item-submenu"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="context-menu-item context-menu-item--has-submenu"
      >
        <div className="context-menu-item__label">
          {t("labels.moveToLayer")}
        </div>
        <span className="context-menu-item__arrow">▶</span>
      </button>
      {isOpen && (
        <ul className="context-menu context-menu--submenu">
          {sortedLayers.map((layer) => (
            <li
              key={layer.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(layer.id);
                onClose();
              }}
            >
              <button type="button" className="context-menu-item">
                <div className="context-menu-item__label">{layer.name}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

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

            // Special handling for moveToLayer action - render as submenu
            if (actionName === "moveToLayer" && appState.layers.length > 1) {
              return (
                <MoveToLayerSubmenu
                  key={idx}
                  layers={appState.layers}
                  onSelect={(layerId) => {
                    onClose(() => {
                      actionManager.executeAction(item, "contextMenu", layerId);
                    });
                  }}
                  onClose={() => onClose()}
                />
              );
            }

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
