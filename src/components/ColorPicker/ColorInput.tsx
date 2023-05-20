import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "./ColorPicker";
import { useAtom } from "jotai";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { KEYS } from "../../keys";
import { COLOR_NAMES } from "../../constants";

interface ColorInputProps {
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

export const ColorInput = ({ color, onChange, label }: ColorInputProps) => {
  const [innerValue, setInnerValue] = useState(color);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const color = getColor(value);

      if (color) {
        onChange(color);
      }
      setInnerValue(value);
    },
    [onChange],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSection]);

  //zsviczian
  let opacity: string = "";
  const hexColor = (color: string): string => {
    if (Object.keys(COLOR_NAMES).includes(color)) {
      return COLOR_NAMES[color];
    }
    const style = new Option().style;
    style.color = color;
    if (!!style.color) {
      const digits = style.color.match(
        /^[^\d]*(\d*)[^\d]*(\d*)[^\d]*(\d*)[^\d]*([\d\.]*)?/,
      );
      if (!digits) {
        return "#000000";
      }
      opacity = digits[4]
        ? (Math.round(parseFloat(digits[4]) * 255) << 0)
            .toString(16)
            .padStart(2, "0")
        : "";
      return `#${(parseInt(digits[1]) << 0).toString(16).padStart(2, "0")}${(
        parseInt(digits[2]) << 0
      )
        .toString(16)
        .padStart(2, "0")}${(parseInt(digits[3]) << 0)
        .toString(16)
        .padStart(2, "0")}`;
    }
    return "#000000";
  };

  return (
    <label className="color-picker__input-label">
      <div className="color-picker__input-hash">#</div>
      <input
        ref={activeSection === "hex" ? inputRef : undefined}
        style={{ border: 0, padding: 0 }}
        spellCheck={false}
        className="color-picker-input"
        aria-label={label}
        onChange={(event) => {
          changeColor(event.target.value);
        }}
        value={(innerValue || "").replace(/^#/, "")}
        onBlur={() => {
          setInnerValue(color);
        }}
        tabIndex={-1}
        onFocus={() => setActiveColorPickerSection("hex")}
        onKeyDown={(e) => {
          if (e.key === KEYS.TAB) {
            return;
          }
          if (e.key === KEYS.ESCAPE) {
            divRef.current?.focus();
          }
          e.stopPropagation();
        }}
      />
      <input //zsviczian
        type="color"
        onChange={(event) => changeColor(event.target.value + opacity)}
        value={hexColor(innerValue || "")}
        onBlur={() => setInnerValue(color)}
        style={{
          marginTop: "auto",
          marginLeft: "5px",
          marginBottom: "auto",
          marginRight: "-0.625rem",
        }}
      />
    </label>
  );
};
