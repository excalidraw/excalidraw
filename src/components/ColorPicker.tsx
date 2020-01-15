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

const colors = {
  canvasBackground: [
    "#DEE6EF",
    "#FCEAD8",
    "#F9E0E0",
    "#E6F1F1",
    "#E0EDDF",
    "#FBF5DD",
    "#F0E6ED",
    "#FFEDEF",
    "#EDE5E1",
    "#F2F0EF",
    "#FFFFFF"
  ],
  elementBackground: [
    "#4E79A7",
    "#F28E2C",
    "#E15759",
    "#76B7B2",
    "#59A14F",
    "#EDC949",
    "#AF7AA1",
    "#FF9DA7",
    "#9C755F",
    "#BAB0AB",
    "transparent"
  ],
  elementStroke: [
    "#324E6B",
    "#9B5B1D",
    "#903839",
    "#4C7572",
    "#396733",
    "#AD9336",
    "#805976",
    "#BA737A",
    "#725646",
    "#88817D",
    "#000000"
  ]
};
