import React from "react";
import MenuTrigger from "./DropdownMenuTrigger";
import MenuItem from "./DropdownMenuItem";
import MenuSeparator from "./DropdownMenuSeparator";
import MenuGroup from "./DropdownMenuGroup";
import MenuContent from "./DropdownMenuContent";
import {
  getMenuContentComponent,
  getMenuTriggerComponent,
} from "./dropdownMenuUtils";

import "./DropdownMenu.scss";

const Menu = ({
  children,
  open,
}: {
  children?: React.ReactNode;
  open: boolean;
}) => {
  const MenuTriggerComp = getMenuTriggerComponent(children);
  const MenuContentComp = getMenuContentComponent(children);
  return (
    <>
      {MenuTriggerComp}
      {open && MenuContentComp}
    </>
  );
};

Menu.Trigger = MenuTrigger;
Menu.Content = MenuContent;
Menu.Item = MenuItem;
Menu.Group = MenuGroup;
Menu.Separator = MenuSeparator;

export default Menu;

Menu.displayName = "DropdownMenu";
