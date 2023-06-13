import clsx from "clsx";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import HotkeyLabel from "./HotkeyLabel";
import { useUIAppState } from "../../context/ui-appState";
import { THEME } from "../../constants";
import { BRIGHT_YELLOW } from "../../colors";
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
  const appState = useUIAppState();

  const btnRef = useRef<HTMLButtonElement>(null);
  const isYellow = '#ffff00'

  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.focus();
    }
  }, [color, activeColorPickerSection]);

  return (
    <div className="color-picker-content--default">
      {colors.map((c, i) => {
        const styleColor = c === isYellow && appState.theme === THEME.DARK ? BRIGHT_YELLOW : c;
        return (
          <button
            ref={color === c ? btnRef : undefined}
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large",
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
            style={{ "--swatch-color": styleColor }}
            key={i}
          >
            <div className="color-picker__button-outline" />
            <HotkeyLabel color={c} keyLabel={i + 1} isCustomColor />
          </button>
        );
      })}
    </div>
  );
};
