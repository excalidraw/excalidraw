import React from "react";
import { atom } from "jotai";
import MenuTrigger from "./MenuTrigger";
import MenuItem from "./MenuItem";
import MenuSeparator from "./MenuSeparator";
import MenuGroup from "./MenuGroup";
import MenuContent from "./MenuContent";
import { getMenuContentComponent, getMenuTriggerComponent } from "./menuUtils";

import "./Menu.scss";
export const isMenuOpenAtom = atom(false);

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

Menu.displayName = "Menu";
