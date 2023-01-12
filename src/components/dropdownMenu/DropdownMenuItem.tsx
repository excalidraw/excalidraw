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
  style,
  ...rest
}: {
  icon?: JSX.Element;
  onSelect: () => void;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const title =
    "aria-label" in rest ? (rest["aria-label"] as string) : undefined;
  return (
    <button
      {...rest}
      onClick={onSelect}
      type="button"
      className={getDrodownMenuItemClassName(className)}
      style={style}
      title={title}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </button>
  );
};

export default DropdownMenuItem;
DropdownMenuItem.displayName = "DropdownMenuItem";
