import clsx from "clsx";
import { CustomColorListProps, activeColorPickerSectionAtom } from "./Picker";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";

export const CustomColorList = ({
  colors,
  color,
  onChange,
  label,
}: CustomColorListProps) => {
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.focus();
    }
  }, [color]);

  return (
    <div className="color-picker-content--default">
      {colors.map((c, i) => {
        return (
          <button
            ref={color === c ? btnRef : undefined}
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large",
              { active: color === c },
            )}
            onClick={() => {
              onChange(c);
              setActiveColorPickerSection("custom");
            }}
            onFocus={() => {
              onChange(c);
              setActiveColorPickerSection("custom");
            }}
            title={c}
            aria-label={label}
            style={{ "--swatch-color": c }}
            key={i}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
};
