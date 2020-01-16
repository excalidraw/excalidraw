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
        className="swatch"
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
        className="swatch-input"
        value={color || ""}
        onPaste={e => onChange(e.clipboardData.getData("text"))}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

const colors = {
  canvasBackground: [
    "#dee6ef",
    "#fcead8",
    "#f9e0e0",
    "#e6f1f1",
    "#e0eddf",
    "#fbf5dd",
    "#f0e6ed",
    "#ffedef",
    "#ede5e1",
    "#f2f0ef",
    "#ffffff"
  ],
  elementBackground: [
    "#4e79a7",
    "#f28e2c",
    "#e15759",
    "#76b7b2",
    "#59a14f",
    "#edc949",
    "#af7aa1",
    "#ff9da7",
    "#9c755f",
    "#bab0ab",
    "transparent"
  ],
  elementStroke: [
    "#324e6b",
    "#9b5b1d",
    "#903839",
    "#4c7572",
    "#396733",
    "#ad9336",
    "#805976",
    "#ba737a",
    "#725646",
    "#88817d",
    "#000000"
  ]
};
