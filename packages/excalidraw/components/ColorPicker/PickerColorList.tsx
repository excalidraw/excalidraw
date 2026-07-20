import clsx from "clsx";
import { useEffect, useRef } from "react";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";

import HotkeyLabel from "./HotkeyLabel";
import {
  activeColorPickerSectionAtom,
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromColor,
} from "./colorPickerUtils";

import type { TranslationKeys } from "../../i18n";

interface PickerColorListProps {
  palette: ColorPaletteCustom;
  color: string | null;
  onChange: (color: string) => void;
  activeShade: number;
  showHotKey?: boolean;
  /**
   * palette colors to hide. Hidden entries keep their position in the hotkey
   * order (their hotkey goes dead instead of remapping the colors after them).
   */
  excludedColors?: readonly string[];
}

const PickerColorList = ({
  palette,
  color,
  onChange,
  activeShade,
  showHotKey = true,
  excludedColors,
}: PickerColorListProps) => {
  const colorObj = getColorNameAndShadeFromColor({
    color,
    palette,
  });
  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current && activeColorPickerSection === "baseColors") {
      btnRef.current.focus();
    }
  }, [colorObj?.colorName, activeColorPickerSection]);

  return (
    <div className="color-picker-content--default">
      {Object.entries(palette).map(([key, value], index) => {
        const color =
          (Array.isArray(value) ? value[activeShade] : value) || "transparent";

        if (excludedColors?.includes(color)) {
          // invisible placeholder so the remaining colors keep their exact
          // grid positions (and hotkeys) — muscle memory stays intact
          return (
            <div
              key={key}
              className="color-picker__button color-picker__button--large"
              style={{ visibility: "hidden" }}
              aria-hidden="true"
            />
          );
        }

        const keybinding = colorPickerHotkeyBindings[index];
        const label = t(
          `colors.${key.replace(/\d+/, "")}` as unknown as TranslationKeys,
          null,
          "",
        );

        return (
          <button
            ref={colorObj?.colorName === key ? btnRef : undefined}
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large has-outline",
              {
                active: colorObj?.colorName === key,
                "is-transparent": color === "transparent" || !color,
              },
            )}
            onClick={() => {
              onChange(color);
              setActiveColorPickerSection("baseColors");
            }}
            title={`${label}${
              color.startsWith("#") ? ` ${color}` : ""
            } — ${keybinding}`}
            aria-label={`${label} — ${keybinding}`}
            style={color ? { "--swatch-color": color } : undefined}
            data-testid={`color-${key}`}
            key={key}
          >
            <div className="color-picker__button-outline" />
            {showHotKey && <HotkeyLabel color={color} keyLabel={keybinding} />}
          </button>
        );
      })}
    </div>
  );
};

export default PickerColorList;
