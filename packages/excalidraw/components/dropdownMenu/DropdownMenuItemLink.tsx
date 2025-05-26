import React from "react";

import MenuItemContent from "./DropdownMenuItemContent";
import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemClick,
} from "./common";

import type { JSX } from "react";

const DropdownMenuItemLink = ({
  icon,
  shortcut,
  href,
  children,
  onSelect,
  className = "",
  selected,
  rel = "noopener",
  ...rest
}: {
  href: string;
  icon?: JSX.Element;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
  selected?: boolean;
  onSelect?: (event: Event) => void;
  rel?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const handleClick = useHandleDropdownMenuItemClick(rest.onClick, onSelect);

  return (
    // eslint-disable-next-line react/jsx-no-target-blank
    <a
      {...rest}
      href={href}
      target="_blank"
      rel={rel || "noopener"}
      className={getDropdownMenuItemClassName(className, selected)}
      title={rest.title ?? rest["aria-label"]}
      onClick={handleClick}
    >
      <MenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </a>
  );
};

export default DropdownMenuItemLink;
DropdownMenuItemLink.displayName = "DropdownMenuItemLink";
