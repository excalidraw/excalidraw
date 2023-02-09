import clsx from "clsx";
import { activeColorPickerSectionAtom } from "./Picker";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
  Palette,
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromHex,
} from "./colorPickerUtils";

interface PickerColorListProps {
  palette: Palette;
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

const PickerColorList = ({
  palette,
  color,
  onChange,
  label,
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
        // const prevShade = colorObj?.shade;

        const color =
          (Array.isArray(value) ? value[3] : value) || "transparent";

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
              // const hasShade = (colorObj?.shade ?? -1) > -1;
              // const color =
              //   (Array.isArray(value)
              //     ? value[hasShade ? prevShade! : 3]
              //     : value) || "transparent";
              onChange(color);
              setActiveColorPickerSection("default");
            }}
            onFocus={() => {
              onChange(color);
              setActiveColorPickerSection("default");
            }}
            title={`${label} — ${key}`}
            aria-label={label}
            style={color ? { "--swatch-color": color } : undefined}
            key={key}
          >
            {colorPickerHotkeyBindings[index]}
          </button>
        );
      })}
    </div>
  );
};

export default PickerColorList;
