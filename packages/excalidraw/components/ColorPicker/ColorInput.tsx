import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import { KEYS, normalizeInputColor } from "@excalidraw/common";

import { getShortcutKey } from "../..//shortcut";
import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useEditorInterface } from "../App";
import { activeEyeDropperAtom } from "../EyeDropper";
import { eyeDropperIcon } from "../icons";

import { activeColorPickerSectionAtom } from "./colorPickerUtils";

import type { ColorPickerType } from "./colorPickerUtils";

/**
 * Validates hex color input and returns an error message if invalid
 * @param value - The hex color value (without #)
 * @returns Error message string or null if valid
 */
const validateHexColor = (value: string): string | null => {
  if (!value) {
    return null; // Empty input is allowed (will be handled by normalizeInputColor)
  }

  // Check for invalid characters (only allow 0-9, a-f, A-F)
  const hexPattern = /^[0-9a-fA-F]*$/;
  if (!hexPattern.test(value)) {
    return t("colorPicker.invalidHexCharacters");
  }

  // Check length (must be 3, 4, 6, or 8 characters)
  const length = value.length;
  if (length !== 3 && length !== 4 && length !== 6 && length !== 8) {
    return t("colorPicker.invalidHexLength");
  }

  return null;
};

export const ColorInput = ({
  color,
  onChange,
  label,
  colorPickerType,
  placeholder,
}: {
  color: string;
  onChange: (color: string) => void;
  label: string;
  colorPickerType: ColorPickerType;
  placeholder?: string;
}) => {
  const editorInterface = useEditorInterface();
  const [innerValue, setInnerValue] = useState(color);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  useEffect(() => {
    setInnerValue(color);
    setErrorMessage(null); // Clear error when color changes externally
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      
      // Validate hex color format
      const validationError = validateHexColor(value);
      if (validationError) {
        setErrorMessage(validationError);
        setInnerValue(value);
        return;
      }

      // Clear error if validation passes
      setErrorMessage(null);

      // Try to normalize the color
      const normalizedColor = normalizeInputColor(value);
      
      if (normalizedColor) {
        onChange(normalizedColor);
      } else if (value) {
        // If normalization fails but we have input, show error
        // (normalizeInputColor handles named colors, so if it fails, it's invalid)
        setErrorMessage(t("colorPicker.invalidHexColor"));
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
    <div className="color-picker__input-wrapper">
      <div
        className={clsx("color-picker__input-label", {
          "has-error": errorMessage,
        })}
      >
        <div className="color-picker__input-hash">#</div>
        <input
          ref={activeSection === "hex" ? inputRef : undefined}
          style={{ border: 0, padding: 0 }}
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          aria-invalid={errorMessage ? "true" : "false"}
          aria-describedby={errorMessage ? "color-input-error" : undefined}
          onChange={(event) => {
            changeColor(event.target.value);
          }}
          value={(innerValue || "").replace(/^#/, "")}
          onBlur={() => {
            setInnerValue(color);
            setErrorMessage(null); // Clear error on blur
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
        {editorInterface.formFactor !== "phone" && (
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
      {errorMessage && (
        <div
          id="color-input-error"
          className="color-picker__input-error"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
};
