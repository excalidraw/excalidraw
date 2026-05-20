import React from "react";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { CLASSES } from "@excalidraw/common";

import DropdownMenuContent from "./DropdownMenuContent";
import DropdownMenuGroup from "./DropdownMenuGroup";
import DropdownMenuItem from "./DropdownMenuItem";
import DropdownMenuItemCustom from "./DropdownMenuItemCustom";
import DropdownMenuItemLink from "./DropdownMenuItemLink";
import MenuSeparator from "./DropdownMenuSeparator";
import DropdownMenuSub from "./DropdownMenuSub";
import DropdownMenuTrigger from "./DropdownMenuTrigger";
import DropdownMenuItemCheckbox from "./DropdownMenuItemCheckbox";
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
  const MenuContentWithState =
    MenuContentComp && React.isValidElement(MenuContentComp)
      ? React.cloneElement(
          MenuContentComp as React.ReactElement<
            React.ComponentProps<typeof DropdownMenuContent>
          >,
          { open },
        )
      : MenuContentComp;

  return (
    <DropdownMenuPrimitive.Root open={open} modal={false}>
      <div
        className={CLASSES.DROPDOWN_MENU_EVENT_WRAPPER}
        style={{
          // remove this div from box layout
          display: "contents",
        }}
      >
        {MenuTriggerComp}
        {MenuContentWithState}
      </div>
    </DropdownMenuPrimitive.Root>
  );
};

DropdownMenu.Trigger = DropdownMenuTrigger;
DropdownMenu.Content = DropdownMenuContent;
DropdownMenu.Item = DropdownMenuItem;
DropdownMenu.ItemCheckbox = DropdownMenuItemCheckbox;
DropdownMenu.ItemLink = DropdownMenuItemLink;
DropdownMenu.ItemCustom = DropdownMenuItemCustom;
DropdownMenu.Group = DropdownMenuGroup;
DropdownMenu.Separator = MenuSeparator;
DropdownMenu.Sub = DropdownMenuSub;

export default DropdownMenu;

DropdownMenu.displayName = "DropdownMenu";
