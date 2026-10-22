import clsx from "clsx";
import React, { useCallback, useEffect, useMemo } from "react";

import { CLASSES, EVENT, KEYS } from "@excalidraw/common";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { useCallbackRefState } from "../../hooks/useCallbackRefState";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useStable } from "../../hooks/useStable";
import { useEditorInterface } from "../App";
import { Island } from "../Island";
import Stack from "../Stack";

import { DropdownMenuContentPropsContext } from "./common";

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
  const [menuNode, setMenuNode] = useCallbackRefState<HTMLDivElement>();
  // Radix mounts the content lazily. Rebind outside-click listeners when the
  // node becomes available so they attach to its owner document.
  const menuRef = useMemo(() => ({ current: menuNode }), [menuNode]);

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
      [callbacksRef, menuRef],
    ),
  );

  useEffect(() => {
    if (!open || !menuNode) {
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

    const ownerDocument = menuNode.ownerDocument;
    ownerDocument.addEventListener(EVENT.KEYDOWN, onKeyDown, option);
    return () => {
      ownerDocument.removeEventListener(EVENT.KEYDOWN, onKeyDown, option);
    };
  }, [callbacksRef, open, menuNode]);

  const classNames = clsx(`dropdown-menu ${className}`, {
    "dropdown-menu--mobile": editorInterface.formFactor === "phone",
  }).trim();

  return (
    <DropdownMenuContentPropsContext.Provider value={{ onSelect }}>
      <DropdownMenuPrimitive.Content
        ref={setMenuNode}
        className={classNames}
        style={style}
        data-testid="dropdown-menu"
        align={align}
        sideOffset={8}
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
    </DropdownMenuContentPropsContext.Provider>
  );
};
MenuContent.displayName = "DropdownMenuContent";

export default MenuContent;
