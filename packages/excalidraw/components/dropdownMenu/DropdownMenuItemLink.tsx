import React from "react";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import MenuItemContent from "./DropdownMenuItemContent";
import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemSelect,
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
  const handleSelect = useHandleDropdownMenuItemSelect(onSelect);

  return (
    // eslint-disable-next-line react/jsx-no-target-blank
    <DropdownMenuPrimitive.Item
      className="radix-menu-item"
      onSelect={handleSelect}
      asChild
    >
      <a
        {...rest}
        href={href}
        target="_blank"
        rel={`noopener ${rel}`}
        className={getDropdownMenuItemClassName(className, selected)}
        title={rest.title ?? rest["aria-label"]}
      >
        <MenuItemContent icon={icon} shortcut={shortcut}>
          {children}
        </MenuItemContent>
      </a>
    </DropdownMenuPrimitive.Item>
  );
};

export default DropdownMenuItemLink;
DropdownMenuItemLink.displayName = "DropdownMenuItemLink";
