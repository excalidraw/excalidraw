import MenuItemContent from "./DropdownMenuItemContent";
import React from "react";
import { getItemClassName } from "./DropdownMenuItem";
const DropdownMenuItemLink = ({
  icon,
  dataTestId,
  shortcut,
  href,
  children,
  className = "",
  style,
  ariaLabel,
}: {
  icon?: JSX.Element;
  children: React.ReactNode;
  dataTestId?: string;
  shortcut?: string;
  className?: string;
  href: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={getItemClassName(className)}
      style={style}
      data-testid={dataTestId}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </a>
  );
};

export default DropdownMenuItemLink;
DropdownMenuItemLink.displayName = "DropdownMenuItemLink";
