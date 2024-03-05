import { Island } from "../Island";
import { useDevice } from "../App";
import clsx from "clsx";
import Stack from "../Stack";
import React, { useEffect, useRef } from "react";
import { DropdownMenuContentPropsContext } from "./common";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { KEYS } from "../../keys";
import { EVENT } from "../../constants";
import { useStable } from "../../hooks/useStable";

const MenuContent = ({
  children,
  onClickOutside,
  className = "",
  onSelect,
  style,
}: {
  children?: React.ReactNode;
  onClickOutside?: () => void;
  className?: string;
  /**
   * Called when any menu item is selected (clicked on).
   */
  onSelect?: (event: Event) => void;
  style?: React.CSSProperties;
}) => {
  const device = useDevice();
  const menuRef = useRef<HTMLDivElement>(null);

  const callbacksRef = useStable({ onClickOutside });

  useOutsideClick(menuRef, () => {
    callbacksRef.onClickOutside?.();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        event.stopImmediatePropagation();
        callbacksRef.onClickOutside?.();
      }
    };

    document.addEventListener(EVENT.KEYDOWN, onKeyDown, {
      // so that we can stop propagation of the event before it reaches
      // event handlers that were bound before this one
      capture: true,
    });
    return () => {
      document.removeEventListener(EVENT.KEYDOWN, onKeyDown);
    };
  }, [callbacksRef]);

  const classNames = clsx(`dropdown-menu ${className}`, {
    "dropdown-menu--mobile": device.editor.isMobile,
  }).trim();

  return (
    <DropdownMenuContentPropsContext.Provider value={{ onSelect }}>
      <div
        ref={menuRef}
        className={classNames}
        style={style}
        data-testid="dropdown-menu"
      >
        {/* the zIndex ensures this menu has higher stacking order,
    see https://github.com/excalidraw/excalidraw/pull/1445 */}
        {device.editor.isMobile ? (
          <Stack.Col className="dropdown-menu-container">{children}</Stack.Col>
        ) : (
          <Island
            className="dropdown-menu-container"
            padding={2}
            style={{ zIndex: 2 }}
          >
            {children}
          </Island>
        )}
      </div>
    </DropdownMenuContentPropsContext.Provider>
  );
};
MenuContent.displayName = "DropdownMenuContent";

export default MenuContent;
