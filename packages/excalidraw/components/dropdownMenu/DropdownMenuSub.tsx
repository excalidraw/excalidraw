import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import DropdownMenuSubContent from "./DropdownMenuSubContent";
import DropdownMenuSubTrigger from "./DropdownMenuSubTrigger";
import {
  getSubMenuContentComponent,
  getSubMenuTriggerComponent,
} from "./dropdownMenuUtils";

const DropdownMenuSub = ({ children }: { children?: React.ReactNode }) => {
  const MenuTriggerComp = getSubMenuTriggerComponent(children);
  const MenuContentComp = getSubMenuContentComponent(children);
  return (
    <DropdownMenuPrimitive.Sub>
      {MenuTriggerComp}
      {MenuContentComp}
    </DropdownMenuPrimitive.Sub>
  );
};

DropdownMenuSub.Trigger = DropdownMenuSubTrigger;
DropdownMenuSub.Content = DropdownMenuSubContent;

DropdownMenuSub.displayName = "DropdownMenuSub";

export default DropdownMenuSub;
