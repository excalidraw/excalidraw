import clsx from "clsx";
import { ContextMenu } from "radix-ui";

import {
  applyDarkModeFilter,
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
  isColorDark,
  THEME,
} from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { useExcalidrawContainer } from "../App";

import { useColorPickerDnD } from "./topPicksDnD";

import type { ColorPickerType } from "./colorPickerUtils";

interface TopPicksProps {
  theme: Theme;
  onChange: (color: string) => void;
  type: ColorPickerType;
  activeColor: string | null;
  topPicks?: readonly string[];
  /** present when the strip is user-customizable — enables the right-click
   * context menu resetting the strip to its default picks */
  onReset?: () => void;
  /** whether custom picks are currently applied (enables the reset item) */
  isCustomized?: boolean;
}

export const TopPicks = ({
  theme,
  onChange,
  type,
  activeColor,
  topPicks,
  onReset,
  isCustomized,
}: TopPicksProps) => {
  const dnd = useColorPickerDnD();
  const dragState = dnd?.dragState ?? null;
  const { container } = useExcalidrawContainer();

  let colors;
  if (type === "elementStroke") {
    colors = DEFAULT_ELEMENT_STROKE_PICKS;
  }

  if (type === "elementBackground") {
    colors = DEFAULT_ELEMENT_BACKGROUND_PICKS;
  }

  if (type === "canvasBackground") {
    colors = DEFAULT_CANVAS_BACKGROUND_PICKS;
  }

  // this one can overwrite defaults
  if (topPicks) {
    colors = topPicks;
  }

  if (!colors) {
    console.error("Invalid type for TopPicks");
    return null;
  }

  // live preview of the reorder result — every pick translates to the slot
  // it would occupy if dropped right now
  const getReorderOffset = (index: number) => {
    if (
      !dragState ||
      dragState.origin.kind !== "pick" ||
      dragState.overIndex === null
    ) {
      return 0;
    }
    const from = dragState.origin.index;
    const to = dragState.overIndex;
    if (from === to) {
      return 0;
    }
    let newIndex = index;
    if (index === from) {
      newIndex = to;
    } else {
      if (index > from) {
        newIndex -= 1;
      }
      if (newIndex >= to) {
        newIndex += 1;
      }
    }
    return (newIndex - index) * dragState.slotSpan;
  };

  const strip = (
    <div
      className={clsx("color-picker__top-picks", {
        "is-dnd-active": !!dragState,
      })}
      ref={dnd?.setStripEl}
    >
      {dragState && (
        <svg
          className="color-picker__top-picks__dnd-outline"
          aria-hidden="true"
        >
          <rect />
        </svg>
      )}
      {colors.map((color: string, index: number) => {
        const reorderOffset = getReorderOffset(index);
        const displayColor = applyDarkModeFilter(color, theme === THEME.DARK);
        return (
          <button
            className={clsx("color-picker__button", {
              active: color === activeColor,
              "is-transparent": color === "transparent" || !color,
              "has-outline": !isColorDark(
                color,
                COLOR_OUTLINE_CONTRAST_THRESHOLD,
              ),
              "is-dnd-source":
                dragState?.origin.kind === "pick" &&
                dragState.origin.index === index,
              "is-dnd-target":
                dragState?.origin.kind === "swatch" &&
                dragState.overIndex === index,
              "is-dnd-duplicate": dragState?.duplicateIndex === index,
            })}
            style={{
              "--swatch-color": displayColor,
              transform: reorderOffset
                ? `translateX(${reorderOffset}px)`
                : undefined,
            }}
            key={color}
            type="button"
            title={color}
            onClick={() => onChange(color)}
            onPointerDown={
              dnd
                ? (event) => dnd.startPickDrag(event, index, color)
                : undefined
            }
            data-testid={`color-top-pick-${color}`}
            data-top-pick-index={index}
          >
            <div className="color-picker__button-outline" />
          </button>
        );
      })}
    </div>
  );

  if (!onReset) {
    return strip;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{strip}</ContextMenu.Trigger>
      <ContextMenu.Portal container={container}>
        <ContextMenu.Content
          className="color-picker__context-menu"
          style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}
        >
          <ContextMenu.Item
            className="color-picker__context-menu-item"
            disabled={!isCustomized}
            onSelect={onReset}
          >
            {t("colorPicker.resetTopPicks")}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};
