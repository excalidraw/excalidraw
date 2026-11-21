import clsx from "clsx";

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
import { TopPicksContextMenu } from "../TopPicksDnD/TopPicksContextMenu";
import {
  getTopPickReorderOffset,
  TopPicksDnDOutline,
} from "../TopPicksDnD/topPicksDnD";

import { useColorPickerDnD } from "./colorTopPicksDnD";
import { getTopPickColor } from "./colorTopPickUtils";

import type { ColorPickerType } from "./colorPickerUtils";
import type { ColorTopPick } from "../../types";

interface TopPicksProps {
  theme: Theme;
  onChange: (pick: ColorTopPick) => void;
  type: ColorPickerType;
  activeColor: string | null;
  topPicks?: readonly ColorTopPick[];
  /** present when the strip is user-customizable — enables the right-click
   * context menu resetting the strip to its default picks */
  onReset?: () => void;
  /** open the color palette to choose a color to save */
  onRequestAdd?: () => void;
  /** remove a saved pen */
  onRemove?: (index: number) => void;
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
  onRequestAdd,
  onRemove,
  isCustomized,
}: TopPicksProps) => {
  const dnd = useColorPickerDnD();
  const dragState = dnd?.dragState ?? null;

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

  return (
    <TopPicksContextMenu
      onReset={onReset}
      isCustomized={!!isCustomized}
      resetLabel={t("colorPicker.resetTopPicks")}
    >
      <div
        className={clsx("color-picker__top-picks top-picks-dnd", {
          "is-dnd-active": !!dragState,
        })}
        ref={dnd?.setStripEl}
      >
        {dragState && <TopPicksDnDOutline />}
        {colors.map((pick: ColorTopPick, index: number) => {
          const color = getTopPickColor(pick);
          const reorderOffset = getTopPickReorderOffset(dragState, index);
          const displayColor = applyDarkModeFilter(color, theme === THEME.DARK);
          return (
            <div
              className="top-picks-dnd__pick-wrapper"
              key={`${color}-${index}`}
            >
              <button
                className={clsx("color-picker__button top-picks-dnd__pick", {
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
                    dragState?.origin.kind === "source" &&
                    dragState.overIndex === index,
                  "is-dnd-duplicate": dragState?.duplicateIndex === index,
                })}
                style={{
                  "--swatch-color": displayColor,
                  transform: reorderOffset
                    ? `translateX(${reorderOffset}px)`
                    : undefined,
                }}
                type="button"
                title={
                  typeof pick === "string"
                    ? color
                    : `${color} · ${pick.strokeWidthKey} · ${pick.strokeStyle} · ${pick.opacity}%`
                }
                onClick={() => onChange(pick)}
                onPointerDown={
                  dnd
                    ? (event) => dnd.startPickDrag(event, index, pick)
                    : undefined
                }
                data-testid={`color-top-pick-${color}`}
                data-top-pick-index={index}
              >
                <div className="color-picker__button-outline" />
                {typeof pick !== "string" && (
                  <span
                    className="top-picks-dnd__preset-mark"
                    style={{
                      borderBottomWidth:
                        pick.strokeWidthKey === "bold"
                          ? 4
                          : pick.strokeWidthKey === "medium"
                          ? 3
                          : 2,
                      opacity: pick.opacity / 100,
                      borderBottomStyle: pick.strokeStyle,
                      borderBottomColor: isColorDark(displayColor)
                        ? "white"
                        : "black",
                    }}
                  />
                )}
              </button>
              {onRemove && (
                <button
                  type="button"
                  className="top-picks-dnd__pick-remove"
                  aria-label="Remove saved pen"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(index);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {dnd && (
          <button
            className={clsx(
              "color-picker__button top-picks-dnd__pick top-picks-dnd__pick--add",
              {
                "is-dnd-target":
                  dragState?.origin.kind === "source" &&
                  dragState.overIndex === colors.length,
              },
            )}
            key="add-top-pick"
            type="button"
            title={"Add saved pen"}
            data-top-pick-index={colors.length}
            onClick={() => {
              onRequestAdd?.();
            }}
            disabled={!onRequestAdd}
          >
            <div className="color-picker__button-outline">+</div>
          </button>
        )}
      </div>
    </TopPicksContextMenu>
  );
};
