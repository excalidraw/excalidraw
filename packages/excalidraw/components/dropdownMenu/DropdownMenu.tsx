import React from "react";

import DropdownMenuContent from "./DropdownMenuContent";
import DropdownMenuGroup from "./DropdownMenuGroup";
import DropdownMenuItem from "./DropdownMenuItem";
import DropdownMenuItemCustom from "./DropdownMenuItemCustom";
import DropdownMenuItemLink from "./DropdownMenuItemLink";
import MenuSeparator from "./DropdownMenuSeparator";
import DropdownMenuTrigger from "./DropdownMenuTrigger";
import {
  getMenuContentComponent,
  getMenuTriggerComponent,
} from "./dropdownMenuUtils";

import "./DropdownMenu.scss";

const DropdownMenu = ({
  children,
  open,
  placement,
}: {
  children?: React.ReactNode;
  open: boolean;
  placement?: "top" | "bottom";
}) => {
  const MenuTriggerComp = getMenuTriggerComponent(children);
  const MenuContentComp = getMenuContentComponent(children);

  // clone the MenuContentComp to pass the placement prop
  const MenuContentCompWithPlacement =
    MenuContentComp && React.isValidElement(MenuContentComp)
      ? React.cloneElement(MenuContentComp as React.ReactElement<any>, {
          placement,
        })
      : MenuContentComp;

  return (
    <div
      className="dropdown-menu-container"
      style={{
        // remove this div from box layout
        display: "contents",
      }}
    >
      {MenuTriggerComp}
      {open && MenuContentCompWithPlacement}
    </div>
  );
};

DropdownMenu.Trigger = DropdownMenuTrigger;
DropdownMenu.Content = DropdownMenuContent;
DropdownMenu.Item = DropdownMenuItem;
DropdownMenu.ItemLink = DropdownMenuItemLink;
DropdownMenu.ItemCustom = DropdownMenuItemCustom;
DropdownMenu.Group = DropdownMenuGroup;
DropdownMenu.Separator = MenuSeparator;

export default DropdownMenu;

DropdownMenu.displayName = "DropdownMenu";
