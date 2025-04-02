import clsx from "clsx";
import { useEffect, useRef } from "react";

import { useAtom } from "../../editor-jotai";

import HotkeyLabel from "./HotkeyLabel";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";

interface CustomColorListProps {
  colors: string[];
  color: string;
  onChange: (color: string) => void;
  label: string;
}

export const CustomColorList = ({
  colors,
  color,
  onChange,
  label,
}: CustomColorListProps) => {
  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.focus();
    }
  }, [color, activeColorPickerSection]);

  return (
    <div className="color-picker-content--default">
      {colors.map((c, i) => {
        return (
          <button
            ref={color === c ? btnRef : undefined}
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large has-outline",
              {
                active: color === c,
                "is-transparent": c === "transparent" || !c,
              },
            )}
            onClick={() => {
              onChange(c);
              setActiveColorPickerSection("custom");
            }}
            title={c}
            aria-label={label}
            style={{ "--swatch-color": c }}
            key={i}
          >
            <div className="color-picker__button-outline" />
            <HotkeyLabel color={c} keyLabel={i + 1} />
          </button>
        );
      })}
    </div>
  );
};
