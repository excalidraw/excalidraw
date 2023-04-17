import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import React from "react";
import MenuItemContent from "./DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "./common";

const DropdownMenuSubTrigger = ({
  children,
  icon,
  shortcut,
  className,
}: {
  children: React.ReactNode;
  icon?: JSX.Element;
  shortcut?: string;
  className?: string;
}) => {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={getDropdownMenuItemClassName(className)}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </DropdownMenuPrimitive.SubTrigger>
  );
};

export default DropdownMenuSubTrigger;
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";
