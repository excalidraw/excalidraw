import { Button } from "../Button";
import MenuItemContent from "./DropdownMenuItemContent";
import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemClick,
} from "./common";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const DropdownMenuSubItem = ({
  icon,
  onSelect,
  children,
  shortcut,
  className,
  ...rest
}: {
  icon?: JSX.Element;
  onSelect: (event: Event) => void;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  const handleClick = useHandleDropdownMenuItemClick(rest.onClick, onSelect);

  return (
    <DropdownMenuPrimitive.Item className="radix-menu-item">
      <Button
        {...rest}
        onClick={handleClick}
        onSelect={() => {}}
        type="button"
        className={getDropdownMenuItemClassName(className)}
        title={rest.title ?? rest["aria-label"]}
      >
        <MenuItemContent icon={icon} shortcut={shortcut}>
          {children}
        </MenuItemContent>
      </Button>
    </DropdownMenuPrimitive.Item>
  );
};

export default DropdownMenuSubItem;
DropdownMenuSubItem.displayName = "DropdownMenuSubItem";
