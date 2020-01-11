import React from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";

export const actionChangeViewBackgroundColor: Action = {
  name: "changeViewBackgroundColor",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, viewBackgroundColor: value } };
  },
  PanelComponent: ({ appState, updateData }) => (
    <>
      <h5>Canvas Background Color</h5>
      <ColorPicker
        type="canvasBackground"
        color={appState.viewBackgroundColor}
        onChange={color => updateData(color)}
      />
    </>
  )
};

export const actionClearCanvas: Action = {
  name: "clearCanvas",
  perform: (elements, appState, value) => {
    return {
      elements: [],
      appState: {
        ...appState,
        viewBackgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      }
    };
  },
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("This will clear the whole canvas. Are you sure?")) {
          updateData(null);
        }
      }}
      title="Clear the canvas & reset background color"
    >
      Clear canvas
    </button>
  )
};
