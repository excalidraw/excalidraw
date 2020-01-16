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
    "#FFFFFF",
    "#F8F9FA",
    "#F1F3F5",
    "#FFF5F5",
    "#FFF0F6",
    "#F8F0FC",
    "#F3F0FF",
    "#EDF2FF",
    "#E7F5FF",
    "#E3FAFC",
    "#E6FCF5",
    "#EBFBEE",
    "#F4FCE3",
    "#FFF9DB",
    "#FFF4E6"
  ],
  // Shade 6
  elementBackground: [
    "transparent",
    "#CED4DA",
    "#868E96",
    "#FA5252",
    "#E64980",
    "#BE4BDB",
    "#7950F2",
    "#4C6EF5",
    "#228BE6",
    "#15AABF",
    "#12B886",
    "#40C057",
    "#82C91E",
    "#FAB005",
    "#FD7E14"
  ],
  // Shade 9
  elementStroke: [
    "#000000",
    "#343A40",
    "#495057",
    "#C92A2A",
    "#A61E4D",
    "#862E9C",
    "#5F3DC4",
    "#364FC7",
    "#1864AB",
    "#0B7285",
    "#087F5B",
    "#2B8A3E",
    "#5C940D",
    "#E67700",
    "#D9480F"
  ]
};
