import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import React from "react";
import MenuItemContent from "./DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "./common";
import { ChevronRight } from "../icons";

const DropdownMenuSubTrigger = ({
  children,
  icon,
  className,
  ...rest
}: {
  children: React.ReactNode;
  icon?: JSX.Element;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <DropdownMenuPrimitive.SubTrigger className="radix-menu-item dropdown-menu__submenu-trigger">
      <div
        {...rest}
        className={getDropdownMenuItemClassName(className)}
        title={rest.title ?? rest["aria-label"]}
      >
        <MenuItemContent icon={icon}>{children}</MenuItemContent>
        <div className="dropdown-menu__submenu-trigger-icon">
          {ChevronRight}
        </div>
      </div>
    </DropdownMenuPrimitive.SubTrigger>
  );
};

export default DropdownMenuSubTrigger;
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";
