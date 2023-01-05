import React from "react";
import MenuItemContent from "./DropdownMenuItemContent";

export const getDrodownMenuItemClassName = (className = "") => {
  return `dropdown-menu-item dropdown-menu-item-base ${className}`.trim();
};

const DropdownMenuItem = ({
  icon,
  onClick,
  children,
  dataTestId,
  shortcut,
  className,
  style,
  ariaLabel,
}: {
  icon?: JSX.Element;
  onClick: () => void;
  children: React.ReactNode;
  dataTestId?: string;
  shortcut?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) => {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      data-testid={dataTestId}
      title={ariaLabel}
      type="button"
      className={getDrodownMenuItemClassName(className)}
      style={style}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </button>
  );
};

export default DropdownMenuItem;
DropdownMenuItem.displayName = "DropdownMenuItem";
