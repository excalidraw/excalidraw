import clsx from "clsx";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
  Palette,
  activeColorPickerSectionAtom,
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromHex,
} from "./colorPickerUtils";
import HotkeyLabel from "./HotkeyLabel";

interface PickerColorListProps {
  palette: Palette;
  color: string | null;
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
  const colorObj = getColorNameAndShadeFromHex({
    hex: color || "transparent",
    palette,
  });
  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current && activeColorPickerSection === "default") {
      btnRef.current.focus();
    }
  }, [colorObj?.colorName, activeColorPickerSection]);

  return (
    <div className="color-picker-content--default">
      {Object.entries(palette).map(([key, value], index) => {
        const color =
          (Array.isArray(value) ? value[activeShade] : value) || "transparent";

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
                "with-border":
                  color === "#ffffff" || color === "transparent" || !color,
              },
            )}
            onClick={() => {
              onChange(color);
              setActiveColorPickerSection("default");
            }}
            onFocus={() => {
              setActiveColorPickerSection("default");
            }}
            title={`${label} — ${key}`}
            aria-label={label}
            style={color ? { "--swatch-color": color } : undefined}
            key={key}
          >
            <div className="color-picker__button-border" />
            <div className="color-picker__button-outline" />
            <HotkeyLabel
              color={color}
              keyLabel={colorPickerHotkeyBindings[index]}
            />
          </button>
        );
      })}
    </div>
  );
};

export default PickerColorList;
