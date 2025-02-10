import { useState, useRef, useEffect, useCallback } from "react";
import { getColor } from "./ColorPicker";
import type { ColorPickerType } from "./colorPickerUtils";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { eyeDropperIcon } from "../icons";
import { useAtom } from "../../editor-jotai";
import { KEYS } from "../../keys";
import { activeEyeDropperAtom } from "../EyeDropper";
import clsx from "clsx";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { getShortcutKey } from "../../utils";
import ColorWheel from "./ColorWheel";
import "./ColorInput.scss";

interface ColorInputProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  colorPickerType: ColorPickerType;
}

export const ColorInput = ({ color, onChange, label, colorPickerType }: ColorInputProps) => {
  const device = useDevice();
  const [innerValue, setInnerValue] = useState(color);
  const [activeSection, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const newColor = getColor(value);
      if (newColor) {
        onChange(newColor);
      } 
      else 
      {
      setInnerValue(value);
      }
    },
    [onChange]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const eyeDropperTriggerRef = useRef<HTMLDivElement>(null);
  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  useEffect(() => {
    return () => setEyeDropperState(null);
  }, [setEyeDropperState]);

  return (
    <div className="color-picker-input-label">
      <div className="color-picker-input-hash">#</div>
      <input
        ref={activeSection === "hex" ? inputRef : undefined}
        style={{ border: 0, padding: 0 }}
        spellCheck={false}
        className="color-picker-input"
        aria-label={label}
        onChange={(event) => changeColor(event.target.value)}
        value={(innerValue || "").replace(/^#/, "")}
        onBlur={() => setInnerValue(color)}
        tabIndex={-1}
        onFocus={() => setActiveColorPickerSection("hex")}
        onKeyDown={(event) => {
          if (event.key === KEYS.TAB) 
            {
              return;
            }
          if (event.key === KEYS.ESCAPE) 
            {
              eyeDropperTriggerRef.current?.focus();
            }
          event.stopPropagation();
        }}
      />
      {!device.editor.isMobile && (
        <div className="color-picker-icons">
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
                    }
              )
            }
            title={`${t("labels.eyeDropper")} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")}`}>
            {eyeDropperIcon}
          </div>
        </div>
      )}
      <div
            style={{
              width: "1px",
              height: "1.25rem",
              backgroundColor: "var(--default-border-color)",
            }}
          />
      <ColorWheel color={innerValue} onChange={changeColor} />
    </div>
  );
};
