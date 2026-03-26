import clsx from "clsx";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  const [showValidationError, setShowValidationError] = useState(false);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );
  const validationMessageId = useId();

  useEffect(() => {
    setInnerValue(color);
    setShowValidationError(false);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const color = normalizeInputColor(value);

      if (color) {
        onChange(color);
        setShowValidationError(false);
      } else if (!value.trim()) {
        setShowValidationError(false);
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
    <div>
      <div
        className={clsx("color-picker__input-label", {
          "color-picker__input-label--invalid": showValidationError,
        })}
      >
        <div className="color-picker__input-hash">#</div>
        <input
          ref={activeSection === "hex" ? inputRef : undefined}
          style={{ border: 0, padding: 0 }}
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          aria-invalid={showValidationError}
          aria-describedby={
            showValidationError ? validationMessageId : undefined
          }
          onChange={(event) => {
            changeColor(event.target.value);
          }}
          value={(innerValue || "").replace(/^#/, "")}
          onBlur={() => {
            const normalizedColor = normalizeInputColor(innerValue);

            if (!innerValue.trim()) {
              setShowValidationError(false);
              setInnerValue(color);
              return;
            }

            if (!normalizedColor) {
              setShowValidationError(true);
              return;
            }

            setShowValidationError(false);
            setInnerValue(normalizedColor);
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
      {showValidationError ? (
        <div
          id={validationMessageId}
          className="color-picker__input-error"
          role="alert"
        >
          {t("colorPicker.invalidHexCode")}
        </div>
      ) : null}
    </div>
  );
};
