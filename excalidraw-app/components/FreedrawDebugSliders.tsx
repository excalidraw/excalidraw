import { DRAWING_CONFIGS, isFreeDrawElement } from "@excalidraw/element";
import { useState, useEffect } from "react";

import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useExcalidrawElements } from "@excalidraw/excalidraw/components/App";

import { round } from "../../packages/math/src";

export const FreedrawDebugSliders = () => {
  const [streamline, setStreamline] = useState<number>(
    DRAWING_CONFIGS.default.variable.streamline,
  );
  const [simplify, setSimplify] = useState<number>(
    DRAWING_CONFIGS.default.variable.simplify,
  );

  useEffect(() => {
    if (!window.h) {
      window.h = {} as any;
    }
    if (!window.h.debugFreedraw) {
      window.h.debugFreedraw = {
        enabled: true,
        ...DRAWING_CONFIGS.default.variable,
      };
    }

    setStreamline(window.h.debugFreedraw.streamline);
    setSimplify(window.h.debugFreedraw.simplify);
  }, []);

  const handleStreamlineChange = (value: number) => {
    setStreamline(value);
    if (window.h && window.h.debugFreedraw) {
      window.h.debugFreedraw.streamline = value;
    }
  };

  const handleSimplifyChange = (value: number) => {
    setSimplify(value);
    if (window.h && window.h.debugFreedraw) {
      window.h.debugFreedraw.simplify = value;
    }
  };

  const [enabled, setEnabled] = useState<boolean>(
    window.h?.debugFreedraw?.enabled ?? true,
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const elements = useExcalidrawElements();
  const appState = useUIAppState();

  const newFreedrawElement =
    appState.newElement && isFreeDrawElement(appState.newElement)
      ? appState.newElement
      : null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "70px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
      }}
    >
      {newFreedrawElement && (
        <div>
          pressures:{" "}
          {newFreedrawElement.simulatePressure
            ? "simulated"
            : JSON.stringify(
                newFreedrawElement.pressures
                  .slice(-4)
                  .map((x) => round(x, 2))
                  .join(" ") || [],
              )}{" "}
          ({round(window.__lastPressure__ || 0, 2) || "?"})
        </div>
      )}
      <div>
        <label>
          {" "}
          enabled
          <br />
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              if (window.h.debugFreedraw) {
                window.h.debugFreedraw.enabled = e.target.checked;
                setEnabled(e.target.checked);
              }
            }}
          />
        </label>
      </div>
      <div>
        <label>
          Streamline: {streamline.toFixed(2)}
          <br />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={streamline}
            onChange={(e) => handleStreamlineChange(parseFloat(e.target.value))}
            style={{ width: "150px" }}
          />
        </label>
      </div>
      <div>
        <label>
          Simplify: {simplify.toFixed(2)}
          <br />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={simplify}
            onChange={(e) => handleSimplifyChange(parseFloat(e.target.value))}
            style={{ width: "150px" }}
          />
        </label>
      </div>
    </div>
  );
};
