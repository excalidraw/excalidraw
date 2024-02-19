import MenuItemContent from "./DropdownMenuItemContent";
import React from "react";
import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemClick,
} from "./common";

const DropdownMenuItemLink = ({
  icon,
  shortcut,
  href,
  children,
  onSelect,
  className = "",
  selected,
  ...rest
}: {
  href: string;
  icon?: JSX.Element;
  children: React.ReactNode;
  shortcut?: string;
  className?: string;
  selected?: boolean;
  onSelect?: (event: Event) => void;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const handleClick = useHandleDropdownMenuItemClick(rest.onClick, onSelect);

  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noreferrer"
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
