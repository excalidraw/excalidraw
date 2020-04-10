import React from "react";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  TextAlign,
} from "../element/types";
import {
  getCommonAttributeOfSelectedElements,
  isSomeElementSelected,
} from "../scene";
import { ButtonSelect } from "../components/ButtonSelect";
import {
  isTextElement,
  redrawTextBoundingBox,
  getNonDeletedElements,
} from "../element";
import { ColorPicker } from "../components/ColorPicker";
import { AppState } from "../../src/types";
import { t } from "../i18n";
import { DEFAULT_FONT } from "../appState";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";

const changeProperty = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
) => {
  return elements.map((element) => {
    if (
      appState.selectedElementIds[element.id] ||
      element.id === appState.editingElement?.id
    ) {
      return callback(element);
    }
    return element;
  });
};

const getFormValue = function <T>(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
  defaultValue?: T,
): T | null {
  const editingElement = appState.editingElement;
  const nonDeletedElements = getNonDeletedElements(elements);
  return (
    (editingElement && getAttribute(editingElement)) ??
    (isSomeElementSelected(nonDeletedElements, appState)
      ? getCommonAttributeOfSelectedElements(
          nonDeletedElements,
          appState,
          getAttribute,
        )
      : defaultValue) ??
    null
  );
};

export const actionChangeStrokeColor = register({
  name: "changeStrokeColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeColor: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeColor: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <>
      <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      <ColorPicker
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          elements,
          appState,
          (element) => element.strokeColor,
          appState.currentItemStrokeColor,
        )}
        onChange={updateData}
      />
    </>
  ),
});

export const actionChangeBackgroundColor = register({
  name: "changeBackgroundColor",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          backgroundColor: value,
        }),
      ),
      appState: { ...appState, currentItemBackgroundColor: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <>
      <h3 aria-hidden="true">{t("labels.background")}</h3>
      <ColorPicker
        type="elementBackground"
        label={t("labels.background")}
        color={getFormValue(
          elements,
          appState,
          (element) => element.backgroundColor,
          appState.currentItemBackgroundColor,
        )}
        onChange={updateData}
      />
    </>
  ),
});

export const actionChangeFillStyle = register({
  name: "changeFillStyle",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          fillStyle: value,
        }),
      ),
      appState: { ...appState, currentItemFillStyle: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.fill")}</legend>
      <ButtonSelect
        options={[
          { value: "hachure", text: t("labels.hachure") },
          { value: "cross-hatch", text: t("labels.crossHatch") },
          { value: "solid", text: t("labels.solid") },
        ]}
        group="fill"
        value={getFormValue(
          elements,
          appState,
          (element) => element.fillStyle,
          appState.currentItemFillStyle,
        )}
        onChange={(value) => {
          updateData(value);
        }}
      />
    </fieldset>
  ),
});

export const actionChangeStrokeWidth = register({
  name: "changeStrokeWidth",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeWidth: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeWidth: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
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
          elements,
          appState,
          (element) => element.strokeWidth,
          appState.currentItemStrokeWidth,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeSloppiness = register({
  name: "changeSloppiness",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          roughness: value,
        }),
      ),
      appState: { ...appState, currentItemRoughness: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.sloppiness")}</legend>
      <ButtonSelect
        group="sloppiness"
        options={[
          { value: 0, text: t("labels.architect") },
          { value: 1, text: t("labels.artist") },
          { value: 2, text: t("labels.cartoonist") },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => element.roughness,
          appState.currentItemRoughness,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeOpacity = register({
  name: "changeOpacity",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          opacity: value,
        }),
      ),
      appState: { ...appState, currentItemOpacity: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <label className="control-label">
      {t("labels.opacity")}
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        onChange={(event) => updateData(+event.target.value)}
        onWheel={(event) => {
          event.stopPropagation();
          const target = event.target as HTMLInputElement;
          const STEP = 10;
          const MAX = 100;
          const MIN = 0;
          const value = +target.value;

          if (event.deltaY < 0 && value < MAX) {
            updateData(value + STEP);
          } else if (event.deltaY > 0 && value > MIN) {
            updateData(value - STEP);
          }
        }}
        value={
          getFormValue(
            elements,
            appState,
            (element) => element.opacity,
            appState.currentItemOpacity,
          ) ?? undefined
        }
      />
    </label>
  ),
});

export const actionChangeFontSize = register({
  name: "changeFontSize",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = newElementWith(el, {
            font: `${value}px ${el.font.split("px ")[1]}`,
          });
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
      appState: {
        ...appState,
        currentItemFont: `${value}px ${
          appState.currentItemFont.split("px ")[1]
        }`,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
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
          elements,
          appState,
          (element) => isTextElement(element) && +element.font.split("px ")[0],
          +(appState.currentItemFont || DEFAULT_FONT).split("px ")[0],
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeFontFamily = register({
  name: "changeFontFamily",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = newElementWith(el, {
            font: `${el.font.split("px ")[0]}px ${value}`,
          });
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
      appState: {
        ...appState,
        currentItemFont: `${
          appState.currentItemFont.split("px ")[0]
        }px ${value}`,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
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
          elements,
          appState,
          (element) => isTextElement(element) && element.font.split("px ")[1],
          (appState.currentItemFont || DEFAULT_FONT).split("px ")[1],
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeTextAlign = register({
  name: "changeTextAlign",
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isTextElement(el)) {
          const element: ExcalidrawTextElement = newElementWith(el, {
            textAlign: value,
          });
          redrawTextBoundingBox(element);
          return element;
        }

        return el;
      }),
      appState: {
        ...appState,
        currentItemTextAlign: value,
      },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <fieldset>
      <legend>{t("labels.textAlign")}</legend>
      <ButtonSelect<TextAlign | false>
        group="text-align"
        options={[
          { value: "left", text: t("labels.left") },
          { value: "center", text: t("labels.center") },
          { value: "right", text: t("labels.right") },
        ]}
        value={getFormValue(
          elements,
          appState,
          (element) => isTextElement(element) && element.textAlign,
          appState.currentItemTextAlign,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});
