import MenuItemContent from "./DropdownMenuItemContent";
import React from "react";
import { getDrodownMenuItemClassName } from "./DropdownMenuItem";
const DropdownMenuItemLink = ({
  icon,
  shortcut,
  href,
  children,
  className = "",
  "aria-label": ariaLabel,
  ...rest
}: {
  icon?: JSX.Element;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
  href: string;
  "aria-label"?: string;
}) => {
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={getDrodownMenuItemClassName(className)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </a>
  );
};

export default DropdownMenuItemLink;
DropdownMenuItemLink.displayName = "DropdownMenuItemLink";
