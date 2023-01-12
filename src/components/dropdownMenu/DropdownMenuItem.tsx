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
  "aria-label": ariaLabel,

  ...rest
}: {
  icon?: JSX.Element;
  onSelect: () => void;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
  "aria-label"?: string;
}) => {
  return (
    <button
      {...rest}
      onClick={onSelect}
      type="button"
      className={getDrodownMenuItemClassName(className)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </button>
  );
};

export default DropdownMenuItem;
DropdownMenuItem.displayName = "DropdownMenuItem";
