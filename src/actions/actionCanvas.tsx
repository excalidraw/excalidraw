import React, { useState } from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash, palete } from "../components/icons";
import { Popover } from "../components/Popover";
import { ToolIcon } from "../components/ToolIcon";

export const actionChangeViewBackgroundColor: Action = {
  name: "changeViewBackgroundColor",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, viewBackgroundColor: value } };
  },
  PanelComponent: ({ appState, updateData }) => {
    const [active, setActive] = useState(false);
    return (
      <div style={{ position: "relative" }}>
        <ToolIcon
          type="button"
          icon={palete}
          title="Change background color"
          aria-label="Change background color"
          onClick={() => setActive(true)}
        />
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
    <ToolIcon
      type="button"
      icon={trash}
      title="Clear the canvas & reset background color"
      aria-label="Clear the canvas & reset background color"
      onClick={() => {
        if (window.confirm("This will clear the whole canvas. Are you sure?")) {
          updateData(null);
        }
      }}
    />
  )
};
