import clsx from "clsx";
import { useEffect, useRef } from "react";

import { applyDarkModeFilter, THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { useAtom } from "../../editor-jotai";

import HotkeyLabel from "./HotkeyLabel";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { useColorPickerDnD } from "./topPicksDnD";

interface CustomColorListProps {
  theme: Theme;
  colors: string[];
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

export const CustomColorList = ({
  theme,
  colors,
  color,
  onChange,
  label,
}: CustomColorListProps) => {
  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );
  const dnd = useColorPickerDnD();

  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.focus();
    }
  }, [color, activeColorPickerSection]);

  return (
    <div className="color-picker-content--default">
      {colors.map((c, i) => {
        const displayColor = applyDarkModeFilter(c, theme === THEME.DARK);
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
            onPointerDown={
              dnd ? (event) => dnd.startSwatchDrag(event, c) : undefined
            }
            title={c}
            aria-label={label}
            style={{ "--swatch-color": displayColor }}
            key={i}
          >
            <div className="color-picker__button-outline" />
            <HotkeyLabel color={displayColor} keyLabel={i + 1} />
          </button>
        );
      })}
    </div>
  );
};
