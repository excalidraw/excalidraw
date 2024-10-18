import clsx from "clsx";
import type { ColorPickerType } from "./colorPickerUtils";
import {
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  DEFAULT_CANVAS_DARK_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_DARK_STROKE_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
} from "../../colors";
import { useAtom } from "jotai";
import { appThemeAtom } from "../../../../excalidraw-app/useHandleAppTheme";
import { useCallback, useEffect } from "react";

interface TopPicksProps {
  onChange: (color: string) => void;
  type: ColorPickerType;
  activeColor: string;
  topPicks?: readonly string[];
}

export const TopPicks = ({
  onChange,
  type,
  activeColor,
  topPicks,
}: TopPicksProps) => {
  const [appTheme] = useAtom(appThemeAtom)[0];
  let colors;
  if (type === "elementStroke") {
    colors = DEFAULT_ELEMENT_STROKE_PICKS;
    if (appTheme === "d") {
      colors = DEFAULT_ELEMENT_DARK_STROKE_PICKS;
    }
  }

  if (type === "elementBackground") {
    colors = DEFAULT_ELEMENT_BACKGROUND_PICKS;
  }

  if (type === "canvasBackground") {
    colors = DEFAULT_CANVAS_BACKGROUND_PICKS;
    if (appTheme === "d") {
      colors = DEFAULT_CANVAS_DARK_BACKGROUND_PICKS;
    }
  }

  // this one can overwrite defaults
  // if (topPicks) {
  //   colors = topPicks;
  // }

  /* this part of the is to reset the active color when theme change
  const OnClickHandel = useCallback(
    (color: string) => {
      onChange(color);
    },
    [onChange],
  );
  useEffect(() => {
    if (type === "canvasBackground" && appTheme === "d") {
      OnClickHandel(DEFAULT_CANVAS_DARK_BACKGROUND_PICKS[0]);
    }
    if (type === "canvasBackground" && appTheme === "l") {
      OnClickHandel(DEFAULT_CANVAS_BACKGROUND_PICKS[0]);
    }
  }, [appTheme]);
  */
  if (!colors) {
    console.error("Invalid type for TopPicks");
    return null;
  }

  return (
    <div className="color-picker__top-picks">
      {colors.map((color: string) => (
        <button
          className={clsx("color-picker__button", {
            active: color === activeColor,
            "is-transparent": color === "transparent" || !color,
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
      ))}
    </div>
  );
};
