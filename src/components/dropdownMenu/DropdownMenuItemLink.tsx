import MenuItemContent from "./DropdownMenuItemContent";
import React from "react";
import { getDrodownMenuItemClassName } from "./DropdownMenuItem";
const DropdownMenuItemLink = ({
  icon,
  shortcut,
  href,
  children,
  className = "",
  ...rest
}: {
  icon?: JSX.Element;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
  href: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={getDrodownMenuItemClassName(className)}
      title={rest.title ?? rest["aria-label"]}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </a>
  );
};

export default DropdownMenuItemLink;
DropdownMenuItemLink.displayName = "DropdownMenuItemLink";
