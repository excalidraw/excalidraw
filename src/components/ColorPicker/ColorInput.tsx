import { useCallback, useEffect, useState } from "react";
import { getColor } from "./ColorPicker";
import clsx from "clsx";
import { useAtom } from "jotai";
import { activeColorPickerSectionAtom } from "./Picker";

interface ColorInputProps {
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

export const ColorInput = ({ color, onChange, label }: ColorInputProps) => {
  const [innerValue, setInnerValue] = useState(color);
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

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

  return (
    <label
      style={{
        // display: "flex",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: "8px",
        alignItems: "center",
        border: "1px solid var(--default-border-color)",
        borderRadius: "8px",
        padding: "0 12px",
        margin: "8px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: "0 4px" }}>#</div>
      <input
        style={{
          border: 0,
          padding: 0,
          // width: "auto",
        }}
        spellCheck={false}
        className="color-picker-input"
        aria-label={label}
        onChange={(event) => {
          changeColor(event.target.value);
          // event.stopPropagation();
        }}
        value={(innerValue || "").replace(/^#/, "")}
        onBlur={() => {
          setInnerValue(color);
          setActiveColorPickerSection(null);
        }}
        autoFocus={false}
        tabIndex={-1}
        onFocus={() => setActiveColorPickerSection("hex")}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      />
      <div
        style={{
          width: "1px",
          height: "1.25rem",
          backgroundColor: "var(--default-border-color)",
        }}
      />
      <div
        style={color ? { "--swatch-color": color } : undefined}
        className={clsx("color-picker__button", {
          "is-transparent": color === "transparent" || !color,
          "with-border":
            color === "#ffffff" || color === "transparent" || !color,
        })}
      />
    </label>
  );
};
