import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import React, { useState, useRef } from "react";

import { useEditorInterface } from "../App";

import DropdownMenuSubContent from "./DropdownMenuSubContent";
import DropdownMenuSubTrigger from "./DropdownMenuSubTrigger";
import {
  getSubMenuContentComponent,
  getSubMenuTriggerComponent,
} from "./dropdownMenuUtils";

const DropdownMenuSub = ({ children }: { children?: React.ReactNode }) => {
  const MenuTriggerComp = getSubMenuTriggerComponent(children);
  const MenuContentComp = getSubMenuContentComponent(children);
  const editorInterface = useEditorInterface();
  const isMobile = editorInterface.formFactor === "phone";
  const [open, setOpen] = useState(false);
  const wasOpenOnTouchStart = useRef(false);
  const closedAtRef = useRef<number>(0);

  if (!isMobile) {
    return (
      <DropdownMenuPrimitive.Sub>
        {MenuTriggerComp}
        {MenuContentComp}
      </DropdownMenuPrimitive.Sub>
    );
  }

  return (
    <DropdownMenuPrimitive.Sub
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          const timeSinceClosed = Date.now() - closedAtRef.current;
          if (timeSinceClosed < 500) {
            return;
          }
          setOpen(true);
        }
      }}
    >
      <div
        onTouchStart={() => {      
          wasOpenOnTouchStart.current = open;
        }}
        onTouchEnd={() => {
          if (wasOpenOnTouchStart.current) {
            closedAtRef.current = Date.now();
            setOpen(false);
          }
        }}
        style={{ display: "contents" }}
      >
        {MenuTriggerComp}
      </div>
      {MenuContentComp}
    </DropdownMenuPrimitive.Sub>
  );
};

DropdownMenuSub.Trigger = DropdownMenuSubTrigger;
DropdownMenuSub.Content = DropdownMenuSubContent;
DropdownMenuSub.displayName = "DropdownMenuSub";

export default DropdownMenuSub;