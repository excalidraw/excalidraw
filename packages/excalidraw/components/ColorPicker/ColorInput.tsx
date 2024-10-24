import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "./ColorPicker";
import { useAtom } from "jotai";
import type { ColorPickerType } from "./colorPickerUtils";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { eyeDropperIcon } from "../icons";
import { jotaiScope } from "../../jotai";
import { KEYS } from "../../keys";
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

const CustomColorPicker = ({ 
  value, 
  onChange, 
  onClose 
}: { 
  value: string, 
  onChange: (color: string) => void,
  onClose: () => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.17, '#ff00ff');
    gradient.addColorStop(0.34, '#0000ff');
    gradient.addColorStop(0.51, '#00ffff');
    gradient.addColorStop(0.68, '#00ff00');
    gradient.addColorStop(0.85, '#ffff00');
    gradient.addColorStop(1, '#ff0000');

    // Draw gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add black to white vertical gradient
    const verticalGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    verticalGradient.addColorStop(0, 'rgba(255,255,255,0)');
    verticalGradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = verticalGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleColorSelect = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const color = `#${[pixel[0], pixel[1], pixel[2]]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')}`;
    onChange(color);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        canvasRef.current && 
        !canvasRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      style={{
        position: 'absolute',
        background: 'var(--popup-bg-color)',
        padding: '8px',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: '1px solid var(--default-border-color)',
        zIndex: 999,
      }}
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={150}
        style={{ 
          cursor: 'crosshair',
          display: 'block'
        }}
        onClick={handleColorSelect}
      />
      <div 
        style={{
          marginTop: '8px',
          width: '200px',
          height: '24px',
          backgroundColor: value,
          border: '1px solid var(--default-border-color)',
          borderRadius: '4px'
        }}
      />
    </div>
  );
};

export const ColorInput = ({
  color,
  onChange,
  label,
  colorPickerType,
}: ColorInputProps) => {
  const device = useDevice();
  const [innerValue, setInnerValue] = useState(color);
  const [showPicker, setShowPicker] = useState(false);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eyeDropperTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const newColor = getColor(value);
      if (newColor) onChange(newColor);
      setInnerValue(value);
    },
    [onChange]
  );

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [activeSection]);

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
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'flex-start' }}>
      <div ref={containerRef} className="color-picker__input-label">
        <div className="color-picker__input-hash">#</div>
        <input
          ref={inputRef}
          spellCheck={false}
          className="color-picker-input"
          style={{
            borderRadius: "4px",
            padding: "4px 6px",
            outline: "none",
            border: "none",
            transition: "border-color 0.2s ease",
          }}
          aria-label={label}
          value={innerValue}
          onClick={() => setShowPicker(true)}
          onChange={(e) => changeColor(e.target.value)}
          onBlur={() => setInnerValue(color)}
          onFocus={() => setActiveColorPickerSection("hex")}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === KEYS.TAB) return;
            if (event.key === KEYS.ESCAPE) {
              setShowPicker(false);
              eyeDropperTriggerRef.current?.focus();
            }
            event.stopPropagation();
          }}
        />
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
              title={`${t("labels.eyeDropper")} — ${KEYS.I.toLocaleUpperCase()} or ${getShortcutKey("Alt")}`}
            >
              {eyeDropperIcon}
            </div>
          </>
        )}
      </div>

      {showPicker && (
  <div style={{ 
    position: 'absolute',
    left: 'calc(100% + 8px)',
    top: '-85px', // This specific offset will align it with the input
    zIndex: 999,
    marginLeft : '10px',
  }}>
          <CustomColorPicker
            value={`#${innerValue}`}
            onChange={(newColor) => {
              const colorWithoutHash = newColor.replace(/^#/, '');
              setInnerValue(colorWithoutHash);
              onChange(newColor);
            }}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
};