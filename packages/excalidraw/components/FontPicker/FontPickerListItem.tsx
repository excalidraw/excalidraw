import React, { useEffect, useRef } from "react";

import { THEME } from "@excalidraw/common";

import type { ValueOf } from "@excalidraw/common/utility-types";

import { Button } from "../Button";

import { useExcalidrawAppState } from "../App";

import { useDevice } from "../App";

import { getDropdownMenuItemClassName } from "../dropdownMenu/common";

import type { JSX } from "react";

const MenuItemContent = ({
  textStyle,
  icon,
  shortcut,
  children,
}: {
  icon?: React.ReactNode;
  shortcut?: string;
  textStyle?: React.CSSProperties;
  children: React.ReactNode;
}) => {
  const device = useDevice();
  return (
    <>
      {icon && <div className="dropdown-menu-item__icon">{icon}</div>}
      <div style={textStyle} className="dropdown-menu-item__text">
        {children}
      </div>
      {shortcut && !device.editor.isMobile && (
        <div className="dropdown-menu-item__shortcut">{shortcut}</div>
      )}
    </>
  );
};

export const FontPickerListItem = ({
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
  onSelect: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  children: React.ReactNode;
  shortcut?: string;
  hovered?: boolean;
  selected?: boolean;
  textStyle?: React.CSSProperties;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
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
    <div className="radix-menu-item">
      <Button
        {...rest}
        ref={ref}
        onSelect={onSelect}
        className={getDropdownMenuItemClassName(className, selected, hovered)}
        title={rest.title ?? rest["aria-label"]}
      >
        <MenuItemContent textStyle={textStyle} icon={icon} shortcut={shortcut}>
          {children}
        </MenuItemContent>
      </Button>
    </div>
  );
};
FontPickerListItem.displayName = "FontPickerListItem";

export const FontPickerListItemBadgeType = {
  GREEN: "green",
  RED: "red",
  BLUE: "blue",
} as const;

export const FontPickerListItemBadge = ({
  type = FontPickerListItemBadgeType.BLUE,
  children,
}: {
  type?: ValueOf<typeof FontPickerListItemBadgeType>;
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
    case FontPickerListItemBadgeType.GREEN:
      Object.assign(style, {
        backgroundColor: "var(--background-color-badge)",
        color: "var(--color-badge)",
      });
      break;
    case FontPickerListItemBadgeType.RED:
      Object.assign(style, {
        backgroundColor: "pink",
        color: "darkred",
      });
      break;
    case FontPickerListItemBadgeType.BLUE:
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
FontPickerListItemBadge.displayName = "DropdownMenuItemBadge";

FontPickerListItem.Badge = FontPickerListItemBadge;
