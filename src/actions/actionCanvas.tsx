import React, { useState } from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash, palete } from "../components/icons";
import { Popover } from "../components/Popover";

export const actionChangeViewBackgroundColor: Action = {
  name: "changeViewBackgroundColor",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, viewBackgroundColor: value } };
  },
  PanelComponent: ({ appState, updateData }) => {
    const [active, setActive] = useState(false);
    return (
      <div style={{ position: "relative" }}>
        <label className="tool" title="Change background color">
          <button
            aria-label="Change background color"
            onClick={() => setActive(true)}
          >
            <div className="toolIcon">{palete}</div>
          </button>
        </label>
        {active && (
          <Popover onCloseRequest={() => setActive(false)}>
            <div style={{ width: 150, position: "relative", top: 4, left: 8 }}>
              <ColorPicker
                type="canvasBackground"
                color={appState.viewBackgroundColor}
                onChange={color => updateData(color)}
              />
            </div>
          </Popover>
        )}
      </div>
    );
  }
};

export const actionClearCanvas: Action = {
  name: "clearCanvas",
  perform: (elements, appState, value) => {
    return {
      elements: [],
      appState: getDefaultAppState()
    };
  },
  PanelComponent: ({ updateData }) => (
    <label className="tool" title="Clear the canvas & reset background color">
      <button
        aria-label="Clear the canvas & reset background color"
        onClick={() => {
          if (
            window.confirm("This will clear the whole canvas. Are you sure?")
          ) {
            updateData(null);
          }
        }}
      >
        <div className="toolIcon">{trash}</div>
      </button>
    </label>
  )
};
