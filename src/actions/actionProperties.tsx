import React from "react";
import { Action } from "./types";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { getCommonAttributeOfSelectedElements } from "../scene";
import { ButtonSelect } from "../components/ButtonSelect";
import { isTextElement, redrawTextBoundingBox } from "../element";
import { ColorPicker } from "../components/ColorPicker";
import { AppState } from "../../src/types";

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

const getFormValue = function<T>(
  editingElement: AppState["editingElement"],
  elements: readonly ExcalidrawElement[],
  getAttribute: (element: ExcalidrawElement) => T,
  defaultValue?: T
): T | null {
  return (
    (editingElement && getAttribute(editingElement)) ||
    getCommonAttributeOfSelectedElements(elements, getAttribute) ||
    defaultValue ||
    null
  );
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.stroke")}</h5>
      <ColorPicker
        type="elementStroke"
        color={getFormValue(
          appState.editingElement,
          elements,
          element => element.strokeColor,
          appState.currentItemStrokeColor
        )}
        onChange={updateData}
      />
    </>
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.background")}</h5>
      <ColorPicker
        type="elementBackground"
        color={getFormValue(
          appState.editingElement,
          elements,
          element => element.backgroundColor,
          appState.currentItemBackgroundColor
        )}
        onChange={updateData}
      />
    </>
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.fill")}</h5>
      <ButtonSelect
        options={[
          { value: "solid", text: "Solid" },
          { value: "hachure", text: "Hachure" },
          { value: "cross-hatch", text: "Cross-hatch" }
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => element.fillStyle
        )}
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.strokeWidth")}</h5>
      <ButtonSelect
        options={[
          { value: 1, text: "Thin" },
          { value: 2, text: "Bold" },
          { value: 4, text: "Extra Bold" }
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => element.strokeWidth
        )}
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.sloppiness")}</h5>
      <ButtonSelect
        options={[
          { value: 0, text: "Architect" },
          { value: 1, text: "Artist" },
          { value: 3, text: "Cartoonist" }
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => element.roughness
        )}
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.opacity")}</h5>
      <input
        type="range"
        min="0"
        max="100"
        onChange={e => updateData(+e.target.value)}
        value={
          getFormValue(
            appState.editingElement,
            elements,
            element => element.opacity,
            100 /* default opacity */
          ) || undefined
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.fontSize")}</h5>
      <ButtonSelect
        options={[
          { value: 16, text: "Small" },
          { value: 20, text: "Medium" },
          { value: 28, text: "Large" },
          { value: 36, text: "Very Large" }
        ]}
        value={getFormValue(
          appState.editingElement,
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
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h5>{t("labels.fontFamily")}</h5>
      <ButtonSelect
        options={[
          { value: "Virgil", text: t("labels.handDrawn") },
          { value: "Helvetica", text: t("labels.normal") },
          { value: "Cascadia", text: t("labels.code") }
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => isTextElement(element) && element.font.split("px ")[1]
        )}
        onChange={value => updateData(value)}
      />
    </>
  )
};
