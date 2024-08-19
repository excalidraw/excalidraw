import React, { useEffect, useRef } from "react";
import {
  getDropdownMenuItemClassName,
  useHandleDropdownMenuItemClick,
} from "./common";
import MenuItemContent from "./DropdownMenuItemContent";
import { useExcalidrawAppState } from "../App";
import { THEME } from "../../constants";
import type { ValueOf } from "../../utility-types";

const DropdownMenuItem = ({
  icon,
  value,
  order,
  children,
  shortcut,
  className,
  hovered,
  selected,
  textStyle,
  onSelect,
  onClick,
  ...rest
}: {
  icon?: JSX.Element;
  value?: string | number | undefined;
  order?: number;
  onSelect?: (event: Event) => void;
  children: React.ReactNode;
  shortcut?: string;
  hovered?: boolean;
  selected?: boolean;
  textStyle?: React.CSSProperties;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  const handleClick = useHandleDropdownMenuItemClick(onClick, onSelect);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hovered) {
      if (order === 0) {
        // scroll into the first item differently, so it's visible what is above (i.e. group title)
        ref.current?.scrollIntoView({ block: "end" });
      } else {
        ref.current?.scrollIntoView({ block: "nearest" });
      }
    }
  }, [hovered, order]);

  return (
    <button
      {...rest}
      ref={ref}
      value={value}
      onClick={handleClick}
      className={getDropdownMenuItemClassName(className, selected, hovered)}
      title={rest.title ?? rest["aria-label"]}
    >
      <MenuItemContent textStyle={textStyle} icon={icon} shortcut={shortcut}>
        {children}
      </MenuItemContent>
    </button>
  );
};
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropDownMenuItemBadgeType = {
  GREEN: "green",
  RED: "red",
  BLUE: "blue",
} as const;

export const DropDownMenuItemBadge = ({
  type = DropDownMenuItemBadgeType.BLUE,
  children,
}: {
  type?: ValueOf<typeof DropDownMenuItemBadgeType>;
  children: React.ReactNode;
}) => {
  const { theme } = useExcalidrawAppState();
  const style = {
    display: "inline-flex",
    marginLeft: "auto",
    padding: "2px 4px",
    borderRadius: 6,
    fontSize: 9,
    fontFamily: "Cascadia, monospace",
    border: theme === THEME.LIGHT ? "1.5px solid white" : "none",
  };

  switch (type) {
    case DropDownMenuItemBadgeType.GREEN:
      Object.assign(style, {
        backgroundColor: "var(--background-color-badge)",
        color: "var(--color-badge)",
      });
      break;
    case DropDownMenuItemBadgeType.RED:
      Object.assign(style, {
        backgroundColor: "pink",
        color: "darkred",
      });
      break;
    case DropDownMenuItemBadgeType.BLUE:
    default:
      Object.assign(style, {
        background: "var(--color-promo)",
        color: "var(--color-surface-lowest)",
      });
  }

  return (
    <div className="DropDownMenuItemBadge" style={style}>
      {children}
    </div>
  );
};
DropDownMenuItemBadge.displayName = "DropdownMenuItemBadge";

DropdownMenuItem.Badge = DropDownMenuItemBadge;

export default DropdownMenuItem;
