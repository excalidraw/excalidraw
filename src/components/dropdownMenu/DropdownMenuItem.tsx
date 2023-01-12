import React from "react";
import MenuItemContent from "./DropdownMenuItemContent";

export const getDrodownMenuItemClassName = (className = "") => {
  return `dropdown-menu-item dropdown-menu-item-base ${className}`.trim();
};

const DropdownMenuItem = ({
  icon,
  onSelect,
  children,
  shortcut,
  className,
  ...rest
}: {
  icon?: JSX.Element;
  onSelect: () => void;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      {...rest}
      onClick={onSelect}
      type="button"
      className={getDrodownMenuItemClassName(className)}
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
