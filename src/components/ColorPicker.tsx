import React from "react";
import { Popover } from "./Popover";

import "./ColorPicker.css";
import { KEYS } from "../keys";
import { t } from "../i18n";

// This is a narrow reimplementation of the awesome react-color Twitter component
// https://github.com/casesandberg/react-color/blob/master/src/components/twitter/Twitter.js

// Unfortunately, we can't detect keyboard layout in the browser. So this will
// only work well for QWERTY but not AZERTY or others...
const keyBindings = [
  ["1", "2", "3", "4", "5"],
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
].flat();

const Picker = function({
  colors,
  color,
  onChange,
  onClose,
  label,
}: {
  colors: string[];
  color: string | null;
  onChange: (color: string) => void;
  onClose: () => void;
  label: string;
}) {
  const firstItem = React.useRef<HTMLButtonElement>();
  const activeItem = React.useRef<HTMLButtonElement>();
  const gallery = React.useRef<HTMLDivElement>();
  const colorInput = React.useRef<HTMLInputElement>();

  React.useEffect(() => {
    // After the component is first mounted
    // focus on first input
    if (activeItem.current) {
      activeItem.current.focus();
    } else if (firstItem.current) {
      firstItem.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === KEYS.TAB) {
      const { activeElement } = document;
      if (e.shiftKey) {
        if (activeElement === firstItem.current) {
          colorInput.current?.focus();
          e.preventDefault();
        }
      } else {
        if (activeElement === colorInput.current) {
          firstItem.current?.focus();
          e.preventDefault();
        }
      }
    } else if (
      e.key === KEYS.ARROW_RIGHT ||
      e.key === KEYS.ARROW_LEFT ||
      e.key === KEYS.ARROW_UP ||
      e.key === KEYS.ARROW_DOWN
    ) {
      const { activeElement } = document;
      const index = Array.prototype.indexOf.call(
        gallery!.current!.children,
        activeElement,
      );
      if (index !== -1) {
        const length = gallery!.current!.children.length;
        const nextIndex =
          e.key === KEYS.ARROW_RIGHT
            ? (index + 1) % length
            : e.key === KEYS.ARROW_LEFT
            ? (length + index - 1) % length
            : e.key === KEYS.ARROW_DOWN
            ? (index + 5) % length
            : e.key === KEYS.ARROW_UP
            ? (length + index - 5) % length
            : index;
        (gallery!.current!.children![nextIndex] as any).focus();
      }
      e.preventDefault();
    } else if (keyBindings.includes(e.key.toLowerCase())) {
      const index = keyBindings.indexOf(e.key.toLowerCase());
      (gallery!.current!.children![index] as any).focus();
      e.preventDefault();
    } else if (e.key === KEYS.ESCAPE || e.key === KEYS.ENTER) {
      e.preventDefault();
      onClose();
    }
    e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div
      className="color-picker"
      role="dialog"
      aria-modal="true"
      aria-label={t("labels.colorPicker")}
      onKeyDown={handleKeyDown}
    >
      <div className="color-picker-triangle-shadow"></div>
      <div className="color-picker-triangle"></div>
      <div className="color-picker-content">
        <div
          className="colors-gallery"
          ref={el => {
            if (el) gallery.current = el;
          }}
        >
          {colors.map((_color, i) => (
            <button
              className="color-picker-swatch"
              onClick={() => {
                onChange(_color);
              }}
              title={`${_color} — ${keyBindings[i].toUpperCase()}`}
              aria-label={_color}
              aria-keyshortcuts={keyBindings[i]}
              style={{ backgroundColor: _color }}
              key={_color}
              ref={el => {
                if (el && i === 0) firstItem.current = el;
                if (el && _color === color) activeItem.current = el;
              }}
              onFocus={() => {
                onChange(_color);
              }}
            >
              {_color === "transparent" ? (
                <div className="color-picker-transparent"></div>
              ) : (
                undefined
              )}
              <span className="color-picker-keybinding">{keyBindings[i]}</span>
            </button>
          ))}
        </div>
        <ColorInput
          color={color}
          label={label}
          onChange={color => {
            onChange(color);
          }}
          ref={colorInput}
        />
      </div>
    </div>
  );
};

const ColorInput = React.forwardRef(
  (
    {
      color,
      onChange,
      label,
    }: {
      color: string | null;
      onChange: (color: string) => void;
      label: string;
    },
    ref,
  ) => {
    const colorRegex = /^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8}|transparent)$/;
    const [innerValue, setInnerValue] = React.useState(color);
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      setInnerValue(color);
    }, [color]);

    React.useImperativeHandle(ref, () => inputRef.current);

    return (
      <div className="color-input-container">
        <div className="color-picker-hash">#</div>
        <input
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          onChange={e => {
            const value = e.target.value.toLowerCase();
            if (value.match(colorRegex)) {
              onChange(value === "transparent" ? "transparent" : "#" + value);
            }
            setInnerValue(value);
          }}
          value={(innerValue || "").replace(/^#/, "")}
          onPaste={e => onChange(e.clipboardData.getData("text"))}
          onBlur={() => setInnerValue(color)}
          ref={inputRef}
        />
      </div>
    );
  },
);

export function ColorPicker({
  type,
  color,
  onChange,
  label,
}: {
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}) {
  const [isActive, setActive] = React.useState(false);
  const pickerButton = React.useRef<HTMLButtonElement>(null);

  return (
    <div>
      <div className="color-picker-control-container">
        <button
          className="color-picker-label-swatch"
          aria-label={label}
          style={color ? { backgroundColor: color } : undefined}
          onClick={() => setActive(!isActive)}
          ref={pickerButton}
        />
        <ColorInput
          color={color}
          label={label}
          onChange={color => {
            onChange(color);
          }}
        />
      </div>
      <React.Suspense fallback="">
        {isActive ? (
          <Popover onCloseRequest={() => setActive(false)}>
            <Picker
              colors={colors[type]}
              color={color || null}
              onChange={changedColor => {
                onChange(changedColor);
              }}
              onClose={() => {
                setActive(false);
                pickerButton.current?.focus();
              }}
              label={label}
            />
          </Popover>
        ) : null}
      </React.Suspense>
    </div>
  );
}

// https://yeun.github.io/open-color/
const colors = {
  // Shade 0
  canvasBackground: [
    "#ffffff",
    "#f8f9fa",
    "#f1f3f5",
    "#fff5f5",
    "#fff0f6",
    "#f8f0fc",
    "#f3f0ff",
    "#edf2ff",
    "#e7f5ff",
    "#e3fafc",
    "#e6fcf5",
    "#ebfbee",
    "#f4fce3",
    "#fff9db",
    "#fff4e6",
  ],
  // Shade 6
  elementBackground: [
    "transparent",
    "#ced4da",
    "#868e96",
    "#fa5252",
    "#e64980",
    "#be4bdb",
    "#7950f2",
    "#4c6ef5",
    "#228be6",
    "#15aabf",
    "#12b886",
    "#40c057",
    "#82c91e",
    "#fab005",
    "#fd7e14",
  ],
  // Shade 9
  elementStroke: [
    "#000000",
    "#343a40",
    "#495057",
    "#c92a2a",
    "#a61e4d",
    "#862e9c",
    "#5f3dc4",
    "#364fc7",
    "#1864ab",
    "#0b7285",
    "#087f5b",
    "#2b8a3e",
    "#5c940d",
    "#e67700",
    "#d9480f",
  ],
};
