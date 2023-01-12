import MenuItemContent from "./DropdownMenuItemContent";
import React from "react";
import { getDrodownMenuItemClassName } from "./DropdownMenuItem";
const DropdownMenuItemLink = ({
  icon,
  shortcut,
  href,
  children,
  className = "",
  style,
  ...rest
}: {
  icon?: JSX.Element;
  children: React.ReactNode;
  dataTestId?: string;
  shortcut?: string;
  className?: string;
  href: string;
  style?: React.CSSProperties;
}) => {
  const title =
    "aria-label" in rest ? (rest["aria-label"] as string) : undefined;
  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={getDrodownMenuItemClassName(className)}
      style={style}
      title={title}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </a>
  );
};

export default DropdownMenuItemLink;
DropdownMenuItemLink.displayName = "DropdownMenuItemLink";
