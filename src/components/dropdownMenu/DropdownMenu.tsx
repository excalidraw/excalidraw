import React from "react";
import DropdownMenuTrigger from "./DropdownMenuTrigger";
import DropdownMenuItem from "./DropdownMenuItem";
import MenuSeparator from "./DropdownMenuSeparator";
import DropdownMenuGroup from "./DropdownMenuGroup";
import DropdownMenuContent from "./DropdownMenuContent";
import DropdownMenuItemLink from "./DropdownMenuItemLink";
import DropdownMenuItemCustom from "./DropdownMenuItemCustom";
import {
  getMenuContentComponent,
  getMenuTriggerComponent,
} from "./dropdownMenuUtils";

import "./DropdownMenu.scss";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

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
