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
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const parsedColor = normalizeInputColor(value);

      if (parsedColor) {
        onChange(parsedColor);
        setError(null);
      } else {
        const strippedValue = value.replace(/^#/, "");
        if (strippedValue.length === 0) {
          setError(null);
        } else if (!/^[0-9a-f]+$/i.test(strippedValue)) {
          setError(t("errors.invalidCharactersInHex"));
        } else if (![3, 4, 6, 8].includes(strippedValue.length)) {
          setError(t("errors.invalidHexLength"));
        } else {
          setError(t("errors.invalidHex"));
        }
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
    <>
      <div
        className={clsx(
          "color-picker__input-label",
          error && "color-picker__input-label--error",
        )}
        style={error ? { borderColor: "var(--color-danger)" } : {}}
      >
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
      {error && (
        <div
          style={{
            color: "var(--color-danger)",
            fontSize: "0.75rem",
            margin: "0 8px 8px 8px",
          }}
        >
          {error}
        </div>
      )}
    </>
  );
};
