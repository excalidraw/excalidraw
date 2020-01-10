import React from "react";
import { Action } from "./types";
import { ExcalidrawElement } from "../element/types";
import { getSelectedAttribute } from "../scene";
import { ButtonSelect } from "../components/ButtonSelect";

const changeProperty = (
  elements: readonly ExcalidrawElement[],
  callback: (element: ExcalidrawElement) => ExcalidrawElement
) => {
  return elements.map(element => {
    if (element.isSelected) {
      return callback(element);
    }
    return element;
  });
};

export const actionChangeOpacity: Action = {
  name: "changeOpacity",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        opacity: +value
      })),
      appState
    };
  },
  PanelComponent: ({ elements, updater }) => (
    <>
      <h5>Opacity</h5>
      <input
        type="range"
        min="0"
        max="100"
        onChange={e => updater(e.target.value)}
        value={
          getSelectedAttribute(elements, element => element.opacity) ||
          0 /* Put the opacity at 0 if there are two conflicting ones */
        }
      />
    </>
  )
};

export const actionChangeStrokeColor: Action = {
  name: "changeStrokeColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        strokeColor: value
      })),
      appState: { ...appState, currentItemStrokeColor: value }
    };
  }
};

export const actionChangeStrokeWidth: Action = {
  name: "changeStrokeWidth",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        strokeColor: value
      })),
      appState: { ...appState, currentItemStrokeColor: value }
    };
  },
  PanelComponent: ({ elements, appState, updater }) => (
    <>
      <h5>Stroke Width</h5>
      <ButtonSelect
        options={[
          { value: 1, text: "Thin" },
          { value: 2, text: "Bold" },
          { value: 4, text: "Extra Bold" }
        ]}
        value={getSelectedAttribute(elements, element => element.strokeWidth)}
        onChange={value => updater(value)}
      />
    </>
  )
};

export const actionChangeBackgroundColor: Action = {
  name: "changeBackgroundColor",
  perform: (elements, appState, formData) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        backgroundColor: formData.value
      })),
      appState: { ...appState, currentItemBackgroundColor: formData.value }
    };
  },
  PanelComponent: ({ elements, appState, updater }) => (
    <>
      <h5>Stroke Width</h5>
      <ButtonSelect
        options={[
          { value: 1, text: "Thin" },
          { value: 2, text: "Bold" },
          { value: 4, text: "Extra Bold" }
        ]}
        value={getSelectedAttribute(elements, element => element.strokeWidth)}
        onChange={value => updater(value)}
      />
    </>
  )
};
