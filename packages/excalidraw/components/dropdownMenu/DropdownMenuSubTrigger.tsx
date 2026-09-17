import React from "react";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { chevronRight } from "../icons";

import { getDropdownMenuItemClassName } from "./common";
import MenuItemContent from "./DropdownMenuItemContent";

import type { JSX } from "react";

const DropdownMenuSubTrigger = ({
  children,
  icon,
  shortcut,
  className,
  ...rest
}: {
  children: React.ReactNode;
  icon?: JSX.Element;
  shortcut?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  return (
    <DropdownMenuPrimitive.SubTrigger asChild>
      <button
        {...rest}
        type="button"
        className={`${getDropdownMenuItemClassName(
          className,
        )} dropdown-menu__submenu-trigger`}
      >
        <MenuItemContent icon={icon} shortcut={shortcut}>
          {children}
        </MenuItemContent>
        <div className="dropdown-menu__submenu-trigger-icon">
          {chevronRight}
        </div>
      </button>
    </DropdownMenuPrimitive.SubTrigger>
  );
};

export default DropdownMenuSubTrigger;
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";
