import React from "react";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

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
}: {
  children?: React.ReactNode;
  open: boolean;
}) => {
  const MenuTriggerComp = getMenuTriggerComponent(children);
  const MenuContentComp = getMenuContentComponent(children);

  return (
    <DropdownMenuPrimitive.Root open={open} modal={false}>
      {MenuTriggerComp}
      {MenuContentComp}
    </DropdownMenuPrimitive.Root>
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
