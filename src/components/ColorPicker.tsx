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
  color: string | undefined;
  onChange: (color: string) => void;
}) {
  const [innerValue, setInnerValue] = React.useState(color);
  React.useEffect(() => {
    setInnerValue(color);
  }, [color]);
  return (
    <div className="color-picker">
      <div className="color-picker-triangle-shadow"></div>
      <div className="color-picker-triangle"></div>
      <div className="color-picker-content">
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
        <div className="color-picker-hash">#</div>
        <div style={{ position: "relative" }}>
          <input
            spellCheck={false}
            className="color-picker-input"
            onChange={e => {
              const value = e.target.value;
              if (value.match(/^([0-9a-f]{3}|[0-9a-f]{6}|transparent)$/)) {
                onChange(value === "transparent" ? "transparent" : "#" + value);
              }
              setInnerValue(value);
            }}
            value={(innerValue || "").replace(/^#/, "")}
          />
        </div>
        <div style={{ clear: "both" }}></div>
      </div>
    </div>
  );
};

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
      <button
        className="color-picker-label-swatch"
        style={color ? { backgroundColor: color } : undefined}
        onClick={() => setActive(!isActive)}
      />
      <React.Suspense fallback="">
        {isActive ? (
          <Popover onCloseRequest={() => setActive(false)}>
            <Picker
              colors={colors[type]}
              color={color || undefined}
              onChange={changedColor => {
                onChange(changedColor);
              }}
            />
          </Popover>
        ) : null}
      </React.Suspense>
      <input
        type="text"
        className="color-picker-swatch-input"
        value={color || ""}
        onPaste={e => onChange(e.clipboardData.getData("text"))}
        onChange={e => onChange(e.target.value)}
      />
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
