import { Island } from "../Island";
import { useDevice } from "../App";
import clsx from "clsx";
import Stack from "../Stack";
import React, { useRef } from "react";
import { DropdownMenuContentPropsContext } from "./common";
import { useOutsideClick } from "../../hooks/useOutsideClick";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const MenuContent = ({
  children,
  onClickOutside,
  className = "",
  onSelect,
  style,
  sideOffset = 4,
  align = "start",
}: {
  children?: React.ReactNode;
  onClickOutside?: () => void;
  className?: string;
  /**
   * Called when any menu item is selected (clicked on).
   */
  onSelect?: (event: Event) => void;
  style?: React.CSSProperties;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}) => {
  const device = useDevice();
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef, () => {
    onClickOutside?.();
  });

  const classNames = clsx(`dropdown-menu ${className}`, {
    "dropdown-menu--mobile": device.isMobile,
  }).trim();

  return (
    <DropdownMenuContentPropsContext.Provider value={{ onSelect }}>
      <DropdownMenuPrimitive.Content
        ref={menuRef}
        className={classNames}
        style={style}
        data-testid="dropdown-menu"
        side="bottom"
        sideOffset={sideOffset}
        align={align}
      >
        {/* the zIndex ensures this menu has higher stacking order,
    see https://github.com/excalidraw/excalidraw/pull/1445 */}
        {device.isMobile ? (
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
      </DropdownMenuPrimitive.Content>
    </DropdownMenuContentPropsContext.Provider>
  );
};
MenuContent.displayName = "DropdownMenuContent";

export default MenuContent;
