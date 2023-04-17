import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  getSubMenuContentComponent,
  getSubMenuTriggerComponent,
} from "./dropdownMenuUtils";
import DropdownMenuSubTrigger from "./DropdownMenuSubTrigger";
import DropdownMenuSubContent from "./DropdownMenuSubContent";
import DropdownMenuSubItem from "./DropdownMenuSubItem";

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
DropdownMenuSub.Item = DropdownMenuSubItem;

export default DropdownMenuSub;
DropdownMenuSub.displayName = "DropdownMenuSub";
