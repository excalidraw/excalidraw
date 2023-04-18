import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import React from "react";
import MenuItemContent from "./DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "./common";

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
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <DropdownMenuPrimitive.SubTrigger className="radix-menuitem">
      <div
        {...rest}
        className={getDropdownMenuItemClassName(className)}
        title={rest.title ?? rest["aria-label"]}
      >
        <MenuItemContent icon={icon} shortcut={shortcut}>
          {children}
        </MenuItemContent>
      </div>
    </DropdownMenuPrimitive.SubTrigger>
  );
};

export default DropdownMenuSubTrigger;
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";
