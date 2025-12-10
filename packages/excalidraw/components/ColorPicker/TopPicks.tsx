import clsx from "clsx";

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
} from "@excalidraw/common";

import { isColorDark } from "./colorPickerUtils";

import type { ColorPickerType } from "./colorPickerUtils";

interface TopPicksProps {
  onChange: (color: string) => void;
  type: ColorPickerType;
  activeColor: string | null;
  topPicks?: readonly string[];
}

export const TopPicks = ({
  onChange,
  type,
  activeColor,
  topPicks,
}: TopPicksProps) => {
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
    <div className="color-picker__top-picks">
      {colors.map((color: string) => {
        if (color === "grid") {
          return (
            <button
              className={clsx("color-picker__button", {
                active: color === activeColor,
              })}
              key={color}
              type="button"
              title="Dotted background"
              onClick={() => onChange(color)}
              data-testid={`color-top-pick-${color}`}
            >
              <div
                className="color-picker__button-outline"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 6H6.01M12 6H12.01M18 6H18.01M6 12H6.01M12 12H12.01M18 12H18.01M6 18H6.01M12 18H12.01M18 18H18.01"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </button>
          );
        }
        return (
          <button
            className={clsx("color-picker__button", {
              active: color === activeColor,
              "is-transparent": color === "transparent" || !color,
              "has-outline": !isColorDark(
                color,
                COLOR_OUTLINE_CONTRAST_THRESHOLD,
              ),
            })}
            style={{ "--swatch-color": color }}
            key={color}
            type="button"
            title={color}
            onClick={() => onChange(color)}
            data-testid={`color-top-pick-${color}`}
          >
            <div className="color-picker__button-outline" />
          </button>
        );
      })}
    </div>
  );
};
