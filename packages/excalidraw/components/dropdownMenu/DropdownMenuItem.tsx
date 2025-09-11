import React, { useRef } from "react";

import { THEME } from "@excalidraw/common";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import type { ValueOf } from "@excalidraw/common/utility-types";

import { Button } from "../Button";

import { useExcalidrawAppState } from "../App";

import MenuItemContent from "./DropdownMenuItemContent";

import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemClick,
} from "./common";

import type { JSX } from "react";

const DropdownMenuItem = ({
  icon,
  value,
  badge,
  order,
  children,
  shortcut,
  className,
  selected,
  onSelect,
  onClick,
  ...rest
}: {
  icon?: JSX.Element;
  badge?: React.ReactNode;
  value?: string | number | undefined;
  order?: number;
  onSelect?: (event: Event) => void;
  children: React.ReactNode;
  shortcut?: string;

  selected?: boolean;

  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  const handleClick = useHandleDropdownMenuItemClick(onClick, onSelect);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenuPrimitive.Item className="radix-menu-item">
      <Button
        {...rest}
        ref={ref}
        onSelect={handleClick}
        className={getDropdownMenuItemClassName(className)}
        title={rest.title ?? rest["aria-label"]}
      >
        <MenuItemContent icon={icon} shortcut={shortcut} badge={badge}>
          {children}
        </MenuItemContent>
      </Button>
    </DropdownMenuPrimitive.Item>
  );
};
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropDownMenuItemBadgeType = {
  GREEN: "green",
  RED: "red",
  BLUE: "blue",
} as const;

export const DropDownMenuItemBadge = ({
  type = DropDownMenuItemBadgeType.BLUE,
  children,
}: {
  type?: ValueOf<typeof DropDownMenuItemBadgeType>;
  children: React.ReactNode;
}) => {
  const { theme } = useExcalidrawAppState();
  const style = {
    display: "inline-flex",
    marginLeft: "auto",
    padding: "2px 4px",
    borderRadius: 6,
    fontSize: 9,
    fontFamily: "Cascadia, monospace",
    border: theme === THEME.LIGHT ? "1.5px solid white" : "none",
  };

  switch (type) {
    case DropDownMenuItemBadgeType.GREEN:
      Object.assign(style, {
        backgroundColor: "var(--background-color-badge)",
        color: "var(--color-badge)",
      });
      break;
    case DropDownMenuItemBadgeType.RED:
      Object.assign(style, {
        backgroundColor: "pink",
        color: "darkred",
      });
      break;
    case DropDownMenuItemBadgeType.BLUE:
    default:
      Object.assign(style, {
        background: "var(--color-promo)",
        color: "var(--color-surface-lowest)",
      });
  }

  return (
    <div className="DropDownMenuItemBadge" style={style}>
      {children}
    </div>
  );
};
DropDownMenuItemBadge.displayName = "DropdownMenuItemBadge";

DropdownMenuItem.Badge = DropDownMenuItemBadge;

export default DropdownMenuItem;
