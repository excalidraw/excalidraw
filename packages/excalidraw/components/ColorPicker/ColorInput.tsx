import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "./ColorPicker";
import { useAtom } from "jotai";
import type { ColorPickerType } from "./colorPickerUtils";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { eyeDropperIcon } from "../icons";
import { jotaiScope } from "../../jotai";
import { KEYS } from "../../keys";
import { COLOR_NAMES } from "../../constants"; //zsviczian
import { activeEyeDropperAtom } from "../EyeDropper";
import clsx from "clsx";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { getShortcutKey } from "../../utils";

interface ColorInputProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  colorPickerType: ColorPickerType;
}

export const ColorInput = ({
  color,
  onChange,
  label,
  colorPickerType,
}: ColorInputProps) => {
  const device = useDevice();
  const [innerValue, setInnerValue] = useState(color);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

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

  const inputRef = useRef<HTMLInputElement>(null);
  const eyeDropperTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSection]);

  //zsviczian
  let opacity: string = "";
  const hexColor = (color: string): string => {
    if (Object.keys(COLOR_NAMES).includes(color)) {
      return COLOR_NAMES[color];
    }
    const style = new Option().style;
    style.color = color;
    if (!!style.color) {
      const digits = style.color.match(
        /^[^\d]*(\d*)[^\d]*(\d*)[^\d]*(\d*)[^\d]*([\d.]*)?/,
      );
      if (!digits) {
        return "#000000";
      }
      opacity = digits[4]
        ? (Math.round(parseFloat(digits[4]) * 255) << 0)
            .toString(16)
            .padStart(2, "0")
        : "";
      return `#${(parseInt(digits[1]) << 0).toString(16).padStart(2, "0")}${(
        parseInt(digits[2]) << 0
      )
        .toString(16)
        .padStart(2, "0")}${(parseInt(digits[3]) << 0)
        .toString(16)
        .padStart(2, "0")}`;
    }
    return "#000000";
  };
  const [eyeDropperState, setEyeDropperState] = useAtom(
    activeEyeDropperAtom,
    jotaiScope,
  );

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
      />
      {/* TODO reenable on mobile with a better UX */}
      {!device.editor.isMobile && (
        <>
          <div
            style={{
              width: "1px",
              height: "1.25rem",
              backgroundColor: "var(--icon-fill-color)", //zsviczian was: --default-border-color
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
      <input //zsviczian
        type="color"
        onChange={(event) => changeColor(event.target.value + opacity)}
        value={hexColor(innerValue || "")}
        onBlur={() => setInnerValue(color)}
        style={{
          marginTop: "auto",
          marginLeft: "4px",
          marginBottom: "auto",
          marginRight: "-0.625rem",
        }}
      />
    </div>
  );
};
