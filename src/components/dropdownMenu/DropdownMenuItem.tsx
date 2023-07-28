import React from "react";
import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemClick,
} from "./common";
import MenuItemContent from "./DropdownMenuItemContent";

const DropdownMenuItem = ({
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
    <button
      {...rest}
      onClick={handleClick}
      type="button"
      className={getDropdownMenuItemClassName(className)}
      title={rest.title ?? rest["aria-label"]}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </button>
  );
};

export default DropdownMenuItem;
DropdownMenuItem.displayName = "DropdownMenuItem";
