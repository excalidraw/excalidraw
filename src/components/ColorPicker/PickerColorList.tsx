import clsx from "clsx";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
  activeColorPickerSectionAtom,
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromColor,
} from "./colorPickerUtils";
import HotkeyLabel from "./HotkeyLabel";
import { ColorPaletteCustom } from "../../colors";
import { t } from "../../i18n";

interface PickerColorListProps {
  palette: ColorPaletteCustom;
  color: string;
  onChange: (color: string) => void;
  label: string;
  activeShade: number;
}

const PickerColorList = ({
  palette,
  color,
  onChange,
  label,
  activeShade,
}: PickerColorListProps) => {
  const colorObj = getColorNameAndShadeFromColor({
    color: color || "transparent",
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
        const label = t(`colors.${key.replace(/\d+/, "")}`, null, "");

        return (
          <button
            ref={colorObj?.colorName === key ? btnRef : undefined}
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large",
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
            <HotkeyLabel color={color} keyLabel={keybinding} />
          </button>
        );
      })}
    </div>
  );
};

export default PickerColorList;
