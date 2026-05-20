import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import { KEYS } from "@excalidraw/common";

import { getShortcutKey } from "../..//shortcut";
import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useEditorInterface } from "../App";
import { activeEyeDropperAtom } from "../EyeDropper";
import { eyeDropperIcon } from "../icons";

import {
  activeColorPickerSectionAtom,
  normalizeHexInputColor,
} from "./colorPickerUtils";

import type {
  ColorPickerType,
  HexInputValidationError,
} from "./colorPickerUtils";

let colorInputErrorCounter = 0;

const getHexInputErrorMessage = (error: HexInputValidationError) => {
  switch (error) {
    case "invalidHexLength":
      return t("colorPicker.invalidHexLength");
    case "invalidHexCharacters":
      return t("colorPicker.invalidHexCharacters");
  }
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
  const [errorId] = useState(() => {
    colorInputErrorCounter += 1;
    return `color-picker-input-error-${colorInputErrorCounter}`;
  });
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  useEffect(() => {
    setInnerValue(color);
    setErrorMessage(null);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const result = normalizeHexInputColor(value);

      if (result.color) {
        onChange(result.color);
        setErrorMessage(null);
      } else if (result.error) {
        setErrorMessage(getHexInputErrorMessage(result.error));
      } else {
        setErrorMessage(null);
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
    <div
      className={clsx("color-picker__input-label", {
        "color-picker__input-label--invalid": errorMessage,
      })}
    >
      <div className="color-picker__input-hash">#</div>
      <input
        ref={activeSection === "hex" ? inputRef : undefined}
        style={{ border: 0, padding: 0 }}
        spellCheck={false}
        className="color-picker-input"
        aria-label={label}
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? errorId : undefined}
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
      {errorMessage && (
        <div id={errorId} className="color-picker__input-error" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
