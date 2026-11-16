import { memo, useCallback } from "react";

import { getFontFamilyString } from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

import { DropDownMenuItemBadge } from "../dropdownMenu/DropdownMenuItem";

import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import { RetryIcon } from "../icons";

import { useFontPickerDnD } from "./fontTopPicksDnD";

import type { FontDescriptor } from "./useFontCatalog";

interface FontPickerListItemProps {
  font: FontDescriptor;
  isHovered: boolean;
  isSelected: boolean;
  /** the callbacks must be stable - a changed one re-renders every row */
  onSelect: (fontFamily: FontFamily) => void;
  onHover: (fontFamily: FontFamily) => void;
  setItemRef: (fontFamily: FontFamily, node: HTMLButtonElement | null) => void;
}

const FONT_DESCRIPTOR_KEYS: readonly (keyof FontDescriptor)[] = [
  "value",
  "text",
  "icon",
  "status",
  "deprecated",
];

const getFontStatusClassName = (status: FontDescriptor["status"]) =>
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

const FontPickerListItemComponent = ({
  font,
  isHovered,
  isSelected,
  onSelect,
  onHover,
  setItemRef,
}: FontPickerListItemProps) => {
  const dnd = useFontPickerDnD();
  const isUnsupported = font.status === "unsupported";

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => setItemRef(font.value, node),
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
        // don't live-preview fonts the dragged one merely passes over
        if (!dnd?.dragState && !isHovered) {
          onHover(font.value);
        }
      }}
      onPointerDown={
        dnd && !isUnsupported
          ? (event) => dnd.startSourceDrag(event, font.value)
          : undefined
      }
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

/**
 * A row re-renders only when what it shows changed. The list can get long
 * ("Browse more fonts"), and it re-renders on every move of the highlight and
 * on every font which registers.
 */
export const FontPickerListItem = memo(
  FontPickerListItemComponent,
  (prev, next) =>
    prev.isHovered === next.isHovered &&
    prev.isSelected === next.isSelected &&
    prev.onSelect === next.onSelect &&
    prev.onHover === next.onHover &&
    prev.setItemRef === next.setItemRef &&
    // the descriptors are rebuilt along with the list (the badge follows
    // `deprecated`)
    FONT_DESCRIPTOR_KEYS.every((key) => prev.font[key] === next.font[key]),
);
