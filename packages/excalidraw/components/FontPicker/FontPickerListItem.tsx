import { useCallback, useEffect, useRef } from "react";

import { getFontFamilyString } from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

import { DropDownMenuItemBadge } from "../dropdownMenu/DropdownMenuItem";

import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import { RetryIcon } from "../icons";

import type { FontDescriptor } from "./useFontCatalog";

interface FontPickerListItemProps {
  font: FontDescriptor;
  order: number;
  isHovered: boolean;
  isSelected: boolean;
  onSelect: (fontFamily: FontFamily) => void;
  onHover: (fontFamily: FontFamily) => void;
  setItemRef: (fontFamily: FontFamily, node: HTMLButtonElement | null) => void;
}

/** shared with the add-by-search row, so the two can't drift apart */
export const getFontStatusClassName = (status: FontDescriptor["status"]) =>
  status ? ` FontPicker__font--${status}` : "";

const renderRetryIcon = (isLoading: boolean) => (
  <span
    className={`FontPicker__retry-icon${
      isLoading ? " FontPicker__retry-icon--loading" : ""
    }`}
    aria-hidden="true"
  >
    {RetryIcon}
  </span>
);

export const FontPickerListItem = ({
  font,
  order,
  isHovered,
  isSelected,
  onSelect,
  onHover,
  setItemRef,
}: FontPickerListItemProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const isUnsupported = font.status === "unsupported";

  useEffect(() => {
    if (!isHovered) {
      return;
    }
    if (order === 0) {
      // scroll into the first item differently, so it's visible what is above (i.e. group title)
      ref.current?.scrollIntoView?.({ block: "end" });
    } else {
      ref.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [isHovered, order]);

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      ref.current = node;
      setItemRef(font.value, node);
    },
    [font.value, setItemRef],
  );

  return (
    <button
      ref={setRef}
      type="button"
      value={font.value}
      className={`${getDropdownMenuItemClassName(
        "",
        isSelected,
        isHovered,
      )}${getFontStatusClassName(font.status)}`}
      title={font.text}
      disabled={isUnsupported}
      aria-busy={font.status === "loading"}
      // allow to tab between search and selected font
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(font.value)}
      onMouseMove={() => {
        if (!isHovered) {
          onHover(font.value);
        }
      }}
    >
      <MenuItemContent
        icon={font.icon}
        badge={
          font.status === "failed" || font.status === "loading" ? (
            renderRetryIcon(font.status === "loading")
          ) : font.badge ? (
            <DropDownMenuItemBadge type={font.badge.type}>
              {font.badge.placeholder}
            </DropDownMenuItemBadge>
          ) : null
        }
        textStyle={{
          fontFamily: getFontFamilyString({ fontFamily: font.value }),
        }}
      >
        {font.text}
      </MenuItemContent>
    </button>
  );
};

export const FontPickerRetryIcon = renderRetryIcon;
