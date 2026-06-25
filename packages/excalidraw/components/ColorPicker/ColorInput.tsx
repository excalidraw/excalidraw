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

let colorInputErrorId = 0;

const VALID_HEX_COLOR_LENGTHS = new Set([3, 4, 6, 8]);

const getHexColorInputError = (value: string) => {
  const color = value.trim().replace(/^#/, "");

  if (!color) {
    return null;
  }

  if (!/^[0-9a-f]+$/i.test(color)) {
    return t("colorPicker.invalidHexCharacters");
  }

  if (!VALID_HEX_COLOR_LENGTHS.has(color.length)) {
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
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );
  const errorIdRef = useRef<string | null>(null);
  if (!errorIdRef.current) {
    errorIdRef.current = `color-picker-input-error-${colorInputErrorId++}`;
  }

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const inputError = getHexColorInputError(value);
      const color = !inputError ? normalizeInputColor(value) : null;

      if (color) {
        onChange(color);
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
  const colorInputError = getHexColorInputError(innerValue);
  const hasColorInputError = !!colorInputError;

  useEffect(() => {
    return () => {
      setEyeDropperState(null);
    };
  }, [setEyeDropperState]);

  return (
    <div className="color-picker__input-container">
      <div
        className={clsx("color-picker__input-label", {
          "color-picker__input-label--invalid": hasColorInputError,
        })}
      >
        <div className="color-picker__input-hash">#</div>
        <input
          ref={activeSection === "hex" ? inputRef : undefined}
          style={{ border: 0, padding: 0 }}
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          aria-invalid={hasColorInputError}
          aria-describedby={
            hasColorInputError ? errorIdRef.current ?? undefined : undefined
          }
          onChange={(event) => {
            changeColor(event.target.value);
          }}
          value={(innerValue || "").replace(/^#/, "")}
          onBlur={() => {
            setInnerValue(color);
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
      {hasColorInputError && (
        <div
          className="color-picker__input-error"
          id={errorIdRef.current ?? undefined}
          role="alert"
        >
          {colorInputError}
        </div>
      )}
    </div>
  );
};
