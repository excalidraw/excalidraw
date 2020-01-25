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
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
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
  defaultValue?: T,
): T | null {
  return (
    (editingElement && getAttribute(editingElement)) ??
    getCommonAttributeOfSelectedElements(elements, getAttribute) ??
    defaultValue ??
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
        strokeColor: value,
      })),
      appState: { ...appState, currentItemStrokeColor: value },
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      <ColorPicker
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          appState.editingElement,
          elements,
          element => element.strokeColor,
          appState.currentItemStrokeColor,
        )}
        onChange={updateData}
      />
    </>
  ),
};

export const actionChangeBackgroundColor: Action = {
  name: "changeBackgroundColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        backgroundColor: value,
      })),
      appState: { ...appState, currentItemBackgroundColor: value },
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <>
      <h3 aria-hidden="true">{t("labels.background")}</h3>
      <ColorPicker
        type="elementBackground"
        label={t("labels.background")}
        color={getFormValue(
          appState.editingElement,
          elements,
          element => element.backgroundColor,
          appState.currentItemBackgroundColor,
        )}
        onChange={updateData}
      />
    </>
  ),
};

export const actionChangeFillStyle: Action = {
  name: "changeFillStyle",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        fillStyle: value,
      })),
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <fieldset>
      <legend>{t("labels.fill")}</legend>
      <ButtonSelect
        options={[
          { value: "solid", text: t("labels.solid") },
          { value: "hachure", text: t("labels.hachure") },
          { value: "cross-hatch", text: t("labels.crossHatch") },
        ]}
        group="fill"
        value={getFormValue(
          appState.editingElement,
          elements,
          element => element.fillStyle,
        )}
        onChange={value => {
          updateData(value);
        }}
      />
    </fieldset>
  ),
};

export const actionChangeStrokeWidth: Action = {
  name: "changeStrokeWidth",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        strokeWidth: value,
      })),
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <fieldset>
      <legend>{t("labels.strokeWidth")}</legend>
      <ButtonSelect
        group="stroke-width"
        options={[
          { value: 1, text: t("labels.thin") },
          { value: 2, text: t("labels.bold") },
          { value: 4, text: t("labels.extraBold") },
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => element.strokeWidth,
        )}
        onChange={value => updateData(value)}
      />
    </fieldset>
  ),
};

export const actionChangeSloppiness: Action = {
  name: "changeSloppiness",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        roughness: value,
      })),
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <fieldset>
      <legend>{t("labels.sloppiness")}</legend>
      <ButtonSelect
        group="sloppiness"
        options={[
          { value: 0, text: t("labels.architect") },
          { value: 1, text: t("labels.artist") },
          { value: 3, text: t("labels.cartoonist") },
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => element.roughness,
        )}
        onChange={value => updateData(value)}
      />
    </fieldset>
  ),
};

export const actionChangeOpacity: Action = {
  name: "changeOpacity",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, el => ({
        ...el,
        shape: null,
        opacity: value,
      })),
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <label className="control-label">
      {t("labels.opacity")}
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
            100 /* default opacity */,
          ) ?? undefined
        }
      />
    </label>
  ),
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
            font: `${value}px ${el.font.split("px ")[1]}`,
          };
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <fieldset>
      <legend>{t("labels.fontSize")}</legend>
      <ButtonSelect
        group="font-size"
        options={[
          { value: 16, text: t("labels.small") },
          { value: 20, text: t("labels.medium") },
          { value: 28, text: t("labels.large") },
          { value: 36, text: t("labels.veryLarge") },
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => isTextElement(element) && +element.font.split("px ")[0],
        )}
        onChange={value => updateData(value)}
      />
    </fieldset>
  ),
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
            font: `${el.font.split("px ")[0]}px ${value}`,
          };
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
    };
  },
  PanelComponent: ({ elements, appState, updateData, t }) => (
    <fieldset>
      <legend>{t("labels.fontFamily")}</legend>
      <ButtonSelect
        group="font-family"
        options={[
          { value: "Virgil", text: t("labels.handDrawn") },
          { value: "Helvetica", text: t("labels.normal") },
          { value: "Cascadia", text: t("labels.code") },
        ]}
        value={getFormValue(
          appState.editingElement,
          elements,
          element => isTextElement(element) && element.font.split("px ")[1],
        )}
        onChange={value => updateData(value)}
      />
    </fieldset>
  ),
};
