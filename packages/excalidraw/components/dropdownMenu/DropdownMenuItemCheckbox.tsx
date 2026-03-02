import { checkIcon, emptyIcon } from "../icons";

import DropdownMenuItem from "./DropdownMenuItem";

import type { DropdownMenuItemProps } from "./DropdownMenuItem";

const DropdownMenuItemCheckbox = (
  props: Omit<DropdownMenuItemProps, "icon"> & { checked: boolean },
) => {
  return (
    <DropdownMenuItem {...props} icon={props.checked ? checkIcon : emptyIcon} />
  );
};

export default DropdownMenuItemCheckbox;
