// packages/excalidraw/components/ColorPicker/ColorInput.tsx

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import { KEYS, getShortcutKey } from "@excalidraw/common";
import { invertHexColor } from "@excalidraw/common/colors";


import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { activeEyeDropperAtom } from "../EyeDropper";
import { eyeDropperIcon } from "../icons";

import { getColor } from "./ColorPicker";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";

import type { ColorPickerType } from "./colorPickerUtils";

// ⬅️ NEW: Add theme prop to the interface
interface ColorInputProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  colorPickerType: ColorPickerType;
  placeholder?: string;
  theme: "light" | "dark"; // ⬅️ NEW: The theme prop
}

export const ColorInput = ({
  color,
  onChange,
  label,
  colorPickerType,
  placeholder,
  theme, // ⬅️ NEW: Destructure the theme prop
}: ColorInputProps) => {
  const device = useDevice();
  const [innerValue, setInnerValue] = useState(color);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  // 1. Calculate the color to display based on the theme
  const displayValue = 
    theme === "dark" && color.startsWith("#") && color.length >= 4 && color !== "transparent"
      ? invertHexColor(color) 
      : color;

  // 2. Update innerValue when the main 'color' prop changes (using the calculated displayValue)
  useEffect(() => {
    // We update innerValue with the *displayed* value, not the raw prop 'color'
    setInnerValue(displayValue); 
  }, [displayValue]); // Depend on displayValue instead of raw 'color'

  // 3. Update changeColor to handle both display and saving logic
  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      
      let colorToSave = value.startsWith("#") ? value : `#${value}`;
      
      // If in dark mode, the user entered the visually inverted color.
      // We must invert it BACK to get the true color to save to the element state.
      if (theme === "dark" && colorToSave.startsWith("#")) {
        // We only invert back if it looks like a valid partial or full hex
        if (colorToSave.length >= 4 || colorToSave.length === 0) {
          colorToSave = invertHexColor(colorToSave);
        }
      }
      
      const color = getColor(colorToSave);

      if (color) {
        onChange(color);
      }
      
      // Update the inner value to reflect the user's input immediately
      setInnerValue(value);
    },
    [onChange, theme], // Depend on theme as it changes logic
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const eyeDropperTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSection]);

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  useEffect(() => {
    return () => {
      setEyeDropperState(null);
    };
  }, [setEyeDropperState]);

  return (
    <div className="color-picker__input-label">
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
        // Display innerValue (which holds the current displayed/inverted color)
        value={(innerValue || "").replace(/^#/, "")} 
        onBlur={() => {
          // On blur, reset to the clean, currently-saved display value
          setInnerValue(displayValue.replace(/^#/, "")); 
        }}
        tabIndex={-1}
        onFocus={() => setActiveColorPickerSection("hex")}
        onKeyDown={(event) => {
          if (event.key === KEYS.TAB) {
            return;
          } else if (event.key === KEYS.ESCAPE) {
            eyeDropperTriggerRef.current?.focus();
          }
          event.stopPropagation();
        }}
        placeholder={placeholder}
      />
      {/* TODO reenable on mobile with a better UX */}
      {!device.editor.isMobile && (
        <>
          <div
            style={{
              width: "1px",
              height: "1.25rem",
              backgroundColor: "var(--default-border-color)",
            }}
          />
          <div
            ref={eyeDropperTriggerRef}
            className={clsx("excalidraw-eye-dropper-trigger", {
              selected: eyeDropperState,
            })}
            onClick={() =>
              setEyeDropperState((s) =>
                s
                  ? null
                  : {
                      keepOpenOnAlt: false,
                      onSelect: (color) => onChange(color),
                      colorPickerType,
                    },
              )
            }
            title={`${t(
              "labels.eyeDropper",
            )} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")} `}
          >
            {eyeDropperIcon}
          </div>
        </>
      )}
    </div>
  );
};