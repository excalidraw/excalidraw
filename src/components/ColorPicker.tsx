import React, { lazy } from "react";
import { Popover } from "./Popover";

const TwitterPicker = lazy(() =>
  import(
    /* webpackPrefetch: true */ "react-color/lib/components/twitter/Twitter"
  )
);

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
            <TwitterPicker
              colors={colors[type]}
              width="205px"
              color={color || undefined}
              onChange={changedColor => {
                onChange(changedColor.hex);
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
    "#FFFFFF"
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
