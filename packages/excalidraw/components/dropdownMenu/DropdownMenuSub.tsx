import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import DropdownMenuSubContent from "./DropdownMenuSubContent";
import DropdownMenuSubTrigger from "./DropdownMenuSubTrigger";
import {
  getSubMenuContentComponent,
  getSubMenuTriggerComponent,
} from "./dropdownMenuUtils";

const DropdownMenuSub = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
} & React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) => {
  const MenuTriggerComp = getSubMenuTriggerComponent(children);
  const MenuContentComp = getSubMenuContentComponent(children);
  return (
    <DropdownMenuPrimitive.Sub {...props}>
      {MenuTriggerComp}
      {MenuContentComp}
    </DropdownMenuPrimitive.Sub>
  );
};

DropdownMenuSub.Trigger = DropdownMenuSubTrigger;
DropdownMenuSub.Content = DropdownMenuSubContent;

DropdownMenuSub.displayName = "DropdownMenuSub";

export default DropdownMenuSub;
