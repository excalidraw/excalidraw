import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "./ColorPicker";
import type { ColorPickerType } from "./colorPickerUtils";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { eyeDropperIcon, colorWheelIcon } from "../icons";
import { useAtom } from "../../editor-jotai";
import { KEYS } from "../../keys";
import { activeEyeDropperAtom } from "../EyeDropper";
import clsx from "clsx";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { getShortcutKey } from "../../utils";
import ColorWheel from "./ColorWheel";
import './ColorInput.scss'

interface ColorInputProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  colorPickerType: ColorPickerType;
}

interface Position {
  x: number;
  y: number;
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
  const [isColorWheelOpen, setIsColorWheelOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const colorWheelTriggerRef = useRef<HTMLDivElement>(null);
  const dragHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  useEffect(() => {
    if (isColorWheelOpen) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const popupWidth = 250; 
      const popupHeight = 300; 
      
      setPosition({
        x: (windowWidth - popupWidth) / 2,
        y: (windowHeight - popupHeight) / 2,
      });
    }
  }, [isColorWheelOpen]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (colorWheelRef.current && dragHeaderRef.current?.contains(e.target as Node)) {
      setIsDragging(true);
      const rect = colorWheelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleDrag = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

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

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  useEffect(() => {
    return () => {
      setEyeDropperState(null);
    };
  }, [setEyeDropperState]);

  // Close color wheel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorWheelRef.current &&
        !colorWheelRef.current.contains(event.target as Node) &&
        !colorWheelTriggerRef.current?.contains(event.target as Node)
      ) {
        setIsColorWheelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
      <div className="color-picker-input-label">
        <div className="color-picker-input-hash">#</div>
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
                      },
                )
              }
              title={`${t(
                "labels.eyeDropper",
              )} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")} `}
            >
              {eyeDropperIcon}
            </div>
            <div
            style={{
              width: "1px",
              height: "1.25rem",
              backgroundColor: "var(--default-border-color)",
            }}
          />
            <div
              ref={colorWheelTriggerRef}
              className={clsx("excalidraw-colorwheel-trigger", {
                selected: isColorWheelOpen,
              })}
              onClick={() => setIsColorWheelOpen(!isColorWheelOpen)}
              title={`${t("labels.colorWheel",
              )} — ${KEYS.I.toLocaleUpperCase()})}`}
            >
              {colorWheelIcon}
            </div>
          </div>
        )}
      {isColorWheelOpen && (
        <div
          ref={colorWheelRef}
          className="color-picker__popup"
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <div 
            ref={dragHeaderRef}
            className="color-picker__popup-header"
            onMouseDown={handleDragStart}
          >
            <h3>Color wheel</h3>
            <button 
              className="color-picker__popup-close"
              onClick={() => setIsColorWheelOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="color-picker__popup-content">
            <ColorWheel onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
};