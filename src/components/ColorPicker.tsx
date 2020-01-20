import React from "react";
import { Popover } from "./Popover";

import "./ColorPicker.css";

// This is a narrow reimplementation of the awesome react-color Twitter component
// https://github.com/casesandberg/react-color/blob/master/src/components/twitter/Twitter.js

const Picker = function({
  colors,
  color,
  onChange
}: {
  colors: string[];
  color: string | null;
  onChange: (color: string) => void;
}) {
  return (
    <div className="color-picker">
      <div className="color-picker-triangle-shadow"></div>
      <div className="color-picker-triangle"></div>
      <div className="color-picker-content">
        <div className="colors-gallery">
          {colors.map(color => (
            <div
              className="color-picker-swatch"
              onClick={() => {
                onChange(color);
              }}
              title={color}
              tabIndex={0}
              style={{ backgroundColor: color }}
              key={color}
            >
              {color === "transparent" ? (
                <div className="color-picker-transparent"></div>
              ) : (
                undefined
              )}
            </div>
          ))}
        </div>
        <ColorInput
          color={color}
          onChange={color => {
            onChange(color);
          }}
        />
      </div>
    </div>
  );
};

function ColorInput({
  color,
  onChange
}: {
  color: string | null;
  onChange: (color: string) => void;
}) {
  const colorRegex = /^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8}|transparent)$/;
  const [innerValue, setInnerValue] = React.useState(color);

  React.useEffect(() => {
    setInnerValue(color);
  }, [color]);

  return (
    <div className="color-input-container">
      <div className="color-picker-hash">#</div>
      <input
        spellCheck={false}
        className="color-picker-input"
        aria-label="Hex color code"
        onChange={e => {
          const value = e.target.value;
          if (value.match(colorRegex)) {
            onChange(value === "transparent" ? "transparent" : "#" + value);
          }
          setInnerValue(value);
        }}
        value={(innerValue || "").replace(/^#/, "")}
        onPaste={e => onChange(e.clipboardData.getData("text"))}
        onBlur={() => setInnerValue(color)}
      />
    </div>
  );
}

export function ColorPicker({
  type,
  color,
  onChange
}: {
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  color: string | null;
  onChange: (color: string) => void;
}) {
  const [isActive, setActive] = React.useState(false);

  return (
    <div>
      <div className="color-picker-control-container">
        <button
          className="color-picker-label-swatch"
          aria-label="Change color"
          style={color ? { backgroundColor: color } : undefined}
          onClick={() => setActive(!isActive)}
        />
        <ColorInput
          color={color}
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
    "#fff4e6"
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
    "#fd7e14"
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
    "#d9480f"
  ]
};
