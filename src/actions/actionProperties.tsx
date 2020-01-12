import React from "react";
import { Action } from "./types";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { getSelectedAttribute } from "../scene";
import { ButtonSelect } from "../components/ButtonSelect";
import { PanelColor } from "../components/panels/PanelColor";
import { isTextElement, redrawTextBoundingBox } from "../element";

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

export const actionChangeStrokeColor: Action = {
  name: "changeStrokeColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        strokeColor: value
      })),
      appState: { ...appState, currentItemStrokeColor: value }
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <PanelColor
      title="Stroke"
      colorType="elementStroke"
      onColorChange={(color: string) => {
        updateData(color);
      }}
      colorValue={getSelectedAttribute(
        elements,
        element => element.strokeColor
      )}
    />
  )
};

export const actionChangeBackgroundColor: Action = {
  name: "changeBackgroundColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        backgroundColor: value
      })),
      appState: { ...appState, currentItemBackgroundColor: value }
    };
  },
  PanelComponent: ({ elements, updateData }) => (
    <PanelColor
      title="Background"
      colorType="elementBackground"
      onColorChange={(color: string) => {
        updateData(color);
      }}
      colorValue={getSelectedAttribute(
        elements,
        element => element.backgroundColor
      )}
    />
  )
};

export const actionChangeFillStyle: Action = {
  name: "changeFillStyle",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        fillStyle: value
      }))
    };
  },
  PanelComponent: ({ elements, updateData }) => (
    <>
      <h5>Fill</h5>
      <ButtonSelect
        options={[
          { value: "solid", text: "Solid" },
          { value: "hachure", text: "Hachure" },
          { value: "cross-hatch", text: "Cross-hatch" }
        ]}
        value={getSelectedAttribute(elements, element => element.fillStyle)}
        onChange={value => {
          updateData(value);
        }}
      />
    </>
  )
};

export const actionChangeStrokeWidth: Action = {
  name: "changeStrokeWidth",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        strokeWidth: value
      }))
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <>
      <h5>Stroke Width</h5>
      <ButtonSelect
        options={[
          { value: 1, text: "Thin" },
          { value: 2, text: "Bold" },
          { value: 4, text: "Extra Bold" }
        ]}
        value={getSelectedAttribute(elements, element => element.strokeWidth)}
        onChange={value => updateData(value)}
      />
    </>
  )
};

export const actionChangeSloppiness: Action = {
  name: "changeSloppiness",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        roughness: value
      }))
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <>
      <h5>Sloppiness</h5>
      <ButtonSelect
        options={[
          { value: 0, text: "Draftsman" },
          { value: 1, text: "Artist" },
          { value: 3, text: "Cartoonist" }
        ]}
        value={getSelectedAttribute(elements, element => element.roughness)}
        onChange={value => updateData(value)}
      />
    </>
  )
};

export const actionChangeOpacity: Action = {
  name: "changeOpacity",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        opacity: value
      }))
    };
  },
  PanelComponent: ({ elements, updateData }) => (
    <>
      <h5>Opacity</h5>
      <input
        type="range"
        min="0"
        max="100"
        onChange={e => updateData(+e.target.value)}
        value={
          getSelectedAttribute(elements, element => element.opacity) ||
          0 /* Put the opacity at 0 if there are two conflicting ones */
        }
      />
    </>
  )
};

export const actionChangeFontSize: Action = {
  name: "changeFontSize",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = {
            ...el,
            shape: null,
            font: `${value}px ${el.font.split("px ")[1]}`
          };
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      })
    };
  },
  PanelComponent: ({ elements, updateData }) => (
    <>
      <h5>Font size</h5>
      <ButtonSelect
        options={[
          { value: 16, text: "Small" },
          { value: 20, text: "Medium" },
          { value: 28, text: "Large" },
          { value: 36, text: "Very Large" }
        ]}
        value={getSelectedAttribute(
          elements,
          element => isTextElement(element) && +element.font.split("px ")[0]
        )}
        onChange={value => updateData(value)}
      />
    </>
  )
};

export const actionChangeFontFamily: Action = {
  name: "changeFontFamily",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = {
            ...el,
            shape: null,
            font: `${el.font.split("px ")[0]}px ${value}`
          };
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      })
    };
  },
  PanelComponent: ({ elements, updateData }) => (
    <>
      <h5>Font family</h5>
      <ButtonSelect
        options={[
          { value: "Virgil", text: "Virgil" },
          { value: "Helvetica", text: "Helvetica" },
          { value: "Courier", text: "Courier" }
        ]}
        value={getSelectedAttribute(
          elements,
          element => isTextElement(element) && element.font.split("px ")[1]
        )}
        onChange={value => updateData(value)}
      />
    </>
  )
};
