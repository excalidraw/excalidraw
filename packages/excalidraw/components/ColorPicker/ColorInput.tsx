import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import { KEYS, getShortcutKey } from "@excalidraw/common";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { activeEyeDropperAtom } from "../EyeDropper";
import { eyeDropperIcon } from "../icons";

import { getColor } from "./ColorPicker";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";

import type { ColorPickerType } from "./colorPickerUtils";

interface ColorInputProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  colorPickerType: ColorPickerType;
  placeholder?: string;
}

export const ColorInput = ({
  color,
  onChange,
  label,
  colorPickerType,
  placeholder,
}: ColorInputProps) => {
  const device = useDevice();
  const [innerValue, setInnerValue] = useState(color);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  useEffect(() => {
    setInnerValue(color);
    setError(null);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const color = getColor(value);

      if (color) {
        onChange(color);
        setError(null);
      } else if (value.trim()) {
        // Only show error for non-empty invalid input
        setError(t("colorPicker.invalidHex"));
      } else {
        setError(null);
      }
      setInnerValue(value);
    },
    [onChange],
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
        aria-invalid={!!error}
        aria-describedby={error ? "color-input-error" : undefined}
        onChange={(event) => {
          changeColor(event.target.value);
        }}
        value={(innerValue || "").replace(/^#/, "")}
        onBlur={() => {
          setInnerValue(color);
          setError(null);
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
      {error && (
        <div
          id="color-input-error"
          role="alert"
          style={{
            color: "var(--color-danger)",
            fontSize: "0.75rem",
            marginTop: "0.25rem",
            position: "absolute",
            top: "100%",
            left: 0,
            whiteSpace: "nowrap",
          }}
        >
          {error}
        </div>
      )}
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
