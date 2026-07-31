import clsx from "clsx";
import React, { useCallback, useEffect, useRef } from "react";

import { CLASSES, EVENT, KEYS } from "@excalidraw/common";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useStable } from "../../hooks/useStable";
import { useEditorInterface, useExcalidrawContainer } from "../App";
import { Island } from "../Island";
import { ObsidianRadixPortal } from "../ObsidianRadixPortal";
import Stack from "../Stack";

import { DropdownMenuContentPropsContext } from "./common";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

const MenuContent = ({
  children,
  onClickOutside,
  className = "",
  onSelect,
  open = true,
  align = "end",
  style,
}: {
  children?: React.ReactNode;
  onClickOutside?: () => void;
  className?: string;
  /**
   * Called when any menu item is selected (clicked on).
   */
  onSelect?: (event: Event) => void;
  open?: boolean;
  style?: React.CSSProperties;
  align?: "start" | "center" | "end";
}) => {
  const editorInterface = useEditorInterface();
  const { container } = useExcalidrawContainer(); //zsviczian -- resolve the correct Obsidian popout document and collision boundary
  const appState = useUIAppState(); //zsviczian
  const menuRef = useRef<HTMLDivElement>(null);

  const callbacksRef = useStable({ onClickOutside });

  useOutsideClick(
    menuRef,
    useCallback(
      (event) => {
        // prevents closing if clicking on the trigger button
        if (
          !menuRef.current
            ?.closest(`.${CLASSES.DROPDOWN_MENU_EVENT_WRAPPER}`)
            ?.contains(event.target)
        ) {
          callbacksRef.onClickOutside?.();
        }
      },
      [callbacksRef],
    ),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        event.stopImmediatePropagation();
        callbacksRef.onClickOutside?.();
      }
    };

    const option = {
      // so that we can stop propagation of the event before it reaches
      // event handlers that were bound before this one
      capture: true,
    };

    document.addEventListener(EVENT.KEYDOWN, onKeyDown, option);
    return () => {
      document.removeEventListener(EVENT.KEYDOWN, onKeyDown, option);
    };
  }, [callbacksRef, open]);

  const classNames = clsx(`dropdown-menu ${className}`, {
    "dropdown-menu--mobile": editorInterface.formFactor === "phone",
    "dropdown-menu--tray":
      editorInterface.formFactor !== "phone" && editorInterface.desktopUIMode === "tray" &&
      appState.openMenu === "canvas", //zsviczian
  }).trim();

  return (
    <DropdownMenuContentPropsContext.Provider value={{ onSelect }}>
      {/* zsviczian START -- body-level portal prevents vertical displacement in Obsidian popout windows, #10221 */}
      <ObsidianRadixPortal
        portal={DropdownMenuPrimitive.Portal}
        container={container}
      >
        <DropdownMenuPrimitive.Content
          ref={menuRef}
          className={classNames}
          style={style}
          data-testid="dropdown-menu"
          align={align}
          sideOffset={8}
          collisionBoundary={container ?? undefined} //zsviczian -- constrain the portaled menu to the Excalidraw viewport, #10221
          onCloseAutoFocus={(event: Event) => event.preventDefault()}
        >
          {/* the zIndex ensures this menu has higher stacking order,
    see https://github.com/excalidraw/excalidraw/pull/1445 */}
          {editorInterface.formFactor === "phone" ? (
            <Stack.Col className="dropdown-menu-container">{children}</Stack.Col>
          ) : (
            <Island className="dropdown-menu-container" padding={2}>
              {children}
            </Island>
          )}
        </DropdownMenuPrimitive.Content>
      </ObsidianRadixPortal>
      {/* zsviczian END */}
    </DropdownMenuContentPropsContext.Provider>
  );
};
MenuContent.displayName = "DropdownMenuContent";

export default MenuContent;
