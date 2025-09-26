import clsx from "clsx";
import { useEffect, useRef } from "react";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";

import HotkeyLabel from "./HotkeyLabel";
import {
  activeColorPickerSectionAtom,
  getColorNameAndShadeFromColor,
} from "./colorPickerUtils";

interface ShadeListProps {
  color: string | null;
  onChange: (color: string) => void;
  palette: ColorPaletteCustom;
}

export const ShadeList = ({ color, onChange, palette }: ShadeListProps) => {
  const colorObj = getColorNameAndShadeFromColor({
    color: color || "transparent",
    palette,
  });

  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

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
          {shades.map((color, i) => (
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
                "color-picker__button color-picker__button--large has-outline",
                { active: i === shade },
              )}
              aria-label="Shade"
              title={`${colorName} - ${i + 1}`}
              style={color ? { "--swatch-color": color } : undefined}
              onClick={() => {
                onChange(color);
                setActiveColorPickerSection("shades");
              }}
            >
              <div className="color-picker__button-outline" />
              <HotkeyLabel color={color} keyLabel={i + 1} isShade />
            </button>
          ))}
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
