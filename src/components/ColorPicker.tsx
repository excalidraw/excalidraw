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
    "#ffffff",
    "#e9ecef",
    "#ffc9c9",
    "#fcc2d7",
    "#eebefa",
    "#d0bfff",
    "#bac8ff",
    "#a5d8ff",
    "#99e9f2",
    "#96f2d7",
    "#b2f2bb",
    "#d8f5a2",
    "#ffec99",
    "#ffd8a8"
  ],
  elementBackground: [
    "transparent",
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
  elementStroke: [
    "#000000",
    "#343a40",
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
