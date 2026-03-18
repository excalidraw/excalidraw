import clsx from "clsx";
import { useEffect, useRef } from "react";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { Tooltip } from "../Tooltip";

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
}

const PickerColorList = ({
  palette,
  color,
  onChange,
  activeShade,
  showHotKey = true,
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

        const keybinding = colorPickerHotkeyBindings[index];
        const label = t(
          `colors.${key.replace(/\d+/, "")}` as unknown as TranslationKeys,
          null,
          "",
        );

        const tooltipLabel = `${label}${
          color.startsWith("#") ? ` ${color}` : ""
        } — ${keybinding}`;

        return (
          <Tooltip key={key} label={tooltipLabel}>
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
              aria-label={`${label} — ${keybinding}`}
              style={color ? { "--swatch-color": color } : undefined}
              data-testid={`color-${key}`}
            >
              <div className="color-picker__button-outline" />
              {showHotKey && (
                <HotkeyLabel color={color} keyLabel={keybinding} />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default PickerColorList;
