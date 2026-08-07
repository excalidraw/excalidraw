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
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase().trim();
      const color = normalizeInputColor(value);

      if (color) {
        onChange(color);
        setErrorMessage(null);
      } else if (value.length === 0) {
        setErrorMessage(null);
      } else if (/^#?[0-9a-f]+$/.test(value)) {
        setErrorMessage(t("colorPicker.invalidHexLength"));
      } else {
        setErrorMessage(t("colorPicker.invalidColor"));
      }
      setInnerValue(value);
    },
    [onChange],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const eyeDropperTriggerRef = useRef<HTMLDivElement>(null);

  // Only auto-focus the hex field when that section is intentionally active.
  // Focusing on every activeSection change (with a stale ref) made the hex
  // input steal focus and swallow the "I" eyedropper shortcut (#9410).
  useEffect(() => {
    if (activeSection === "hex") {
      inputRef.current?.focus();
    }
  }, [activeSection]);

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  useEffect(() => {
    return () => {
      setEyeDropperState(null);
    };
  }, [setEyeDropperState]);

  const toggleEyeDropper = useCallback(() => {
    setEyeDropperState((s) =>
      s
        ? null
        : {
            keepOpenOnAlt: false,
            onSelect: (color) => onChange(color),
            colorPickerType,
          },
    );
  }, [colorPickerType, onChange, setEyeDropperState]);

  return (
    <div className="color-picker__input-label-container">
      <div
        className={clsx("color-picker__input-label", {
          "has-error": errorMessage,
        })}
      >
        <div className="color-picker__input-hash">#</div>
        <input
          ref={inputRef}
          style={{ border: 0, padding: 0 }}
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          aria-invalid={!!errorMessage}
          onChange={(event) => {
            changeColor(event.target.value);
          }}
          value={(innerValue || "").replace(/^#/, "")}
          onBlur={() => {
            setInnerValue(color);
            setErrorMessage(null);
          }}
          tabIndex={-1}
          onFocus={() => setActiveColorPickerSection("hex")}
          onKeyDown={(event) => {
            if (event.key === KEYS.TAB) {
              // Let the parent color picker handle section navigation
              return;
            }

            if (event.key === KEYS.ESCAPE) {
              eyeDropperTriggerRef.current?.focus();
              event.stopPropagation();
              return;
            }

            // Eyedropper shortcuts must work while the hex field is focused.
            // Otherwise "S then I" (open stroke picker → eyedropper) degrades
            // into typing "i" into the hex input (#9410).
            if (event.key === KEYS.I || event.key === KEYS.ALT) {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === KEYS.I) {
                toggleEyeDropper();
              } else {
                // Match picker behavior: Alt holds the eyedropper open
                setEyeDropperState((state) => {
                  state = state || {
                    keepOpenOnAlt: true,
                    onSelect: onChange,
                    colorPickerType,
                  };
                  state.keepOpenOnAlt = true;
                  return state;
                });
              }
              return;
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
              onClick={toggleEyeDropper}
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
        <div className="color-picker__error-message" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
