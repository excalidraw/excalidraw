import clsx from "clsx";
import { useEffect, useRef } from "react";

import {
  applyDarkModeFilter,
  THEME,
  type ColorPaletteCustom,
} from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";

import HotkeyLabel from "./HotkeyLabel";
import {
  activeColorPickerSectionAtom,
  getColorNameAndShadeFromColor,
} from "./colorPickerUtils";
import { useColorPickerDnD } from "./topPicksDnD";

interface ShadeListProps {
  theme: Theme;
  color: string | null;
  onChange: (color: string) => void;
  palette: ColorPaletteCustom;
  showHotKey?: boolean;
}

export const ShadeList = ({
  theme,
  color,
  onChange,
  palette,
  showHotKey,
}: ShadeListProps) => {
  const colorObj = getColorNameAndShadeFromColor({
    color: color || "transparent",
    palette,
  });

  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );
  const dnd = useColorPickerDnD();

  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current && activeColorPickerSection === "shades") {
      btnRef.current.focus();
    }
  }, [colorObj, activeColorPickerSection]);

  if (colorObj) {
    const { colorName, shade } = colorObj;

    const shades = palette[colorName];

    if (Array.isArray(shades)) {
      return (
        <div className="color-picker-content--default shades">
          {shades.map((color, i) => {
            const displayColor = applyDarkModeFilter(
              color,
              theme === THEME.DARK,
            );
            return (
              <button
                ref={
                  i === shade && activeColorPickerSection === "shades"
                    ? btnRef
                    : undefined
                }
                tabIndex={-1}
                key={i}
                type="button"
                className={clsx(
                  "color-picker__button color-picker__button--large",
                  {
                    active: i === shade,
                  },
                )}
                aria-label="Shade"
                title={`${colorName} - ${i + 1}`}
                style={color ? { "--swatch-color": displayColor } : undefined}
                onClick={() => {
                  onChange(color);
                  setActiveColorPickerSection("shades");
                }}
                onPointerDown={
                  dnd ? (event) => dnd.startSwatchDrag(event, color) : undefined
                }
              >
                <div className="color-picker__button-outline" />
                {showHotKey && (
                  <HotkeyLabel color={displayColor} keyLabel={i + 1} isShade />
                )}
              </button>
            );
          })}
        </div>
      );
    }
  }

  return (
    <div
      className="color-picker-content--default"
      style={{ position: "relative" }}
      tabIndex={-1}
    >
      <button
        type="button"
        tabIndex={-1}
        className="color-picker__button color-picker__button--large color-picker__button--no-focus-visible"
      />
      <div
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontSize: "0.75rem",
        }}
      >
        {t("colorPicker.noShades")}
      </div>
    </div>
  );
};
