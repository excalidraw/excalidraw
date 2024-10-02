import clsx from "clsx";
import {
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from "../components/icons";
import { isTextElement } from "../element/typeChecks";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  TextAlign,
} from "../element/types";
import { t } from "../i18n";
import { StoreAction } from "../store";
import type { AppClassProperties, AppState } from "../types";
import { register } from "./register";
import { changeProperty, getFormValue } from "./actionProperties";
import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "../element/textElement";
import { newElementWith } from "../element/mutateElement";
import { CODES, KEYS } from "../keys";

const alignTextElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  alignment: TextAlign,
) => {
  return {
    elements: changeProperty(
      elements,
      appState,
      (oldElement) => {
        if (isTextElement(oldElement)) {
          const newElement: ExcalidrawTextElement = newElementWith(oldElement, {
            textAlign: alignment,
          });
          redrawTextBoundingBox(
            newElement,
            app.scene.getContainerElement(oldElement),
            app.scene.getNonDeletedElementsMap(),
          );
          return newElement;
        }

        return oldElement;
      },
      true,
    ),
    appState: {
      ...appState,
      currentItemTextAlign: alignment,
    },
    storeAction: StoreAction.CAPTURE,
  };
};

export const actionChangeTextAlignLeft = register({
  name: "changeTextAlignLeft",
  label: t("labels.alignTextLeft"),
  trackEvent: false,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.L,
  perform: (elements, appState, _, app) =>
    alignTextElements(elements, appState, app, "left"),
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const selectedTextAlign = getFormValue(
      elements,
      appState,
      (element) => {
        if (isTextElement(element)) {
          return element.textAlign;
        }
        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          return boundTextElement.textAlign;
        }
        return null;
      },
      (element) =>
        isTextElement(element) ||
        getBoundTextElement(element, elementsMap) !== null,
      (hasSelection) => (hasSelection ? null : appState.currentItemTextAlign),
    );
    return (
      <label
        key={t("labels.left")}
        className={clsx({ active: selectedTextAlign === "left" })}
        title={t("labels.left")}
      >
        <input
          type="radio"
          name="text-align"
          onChange={() => updateData("left")}
          checked={selectedTextAlign === "left"}
          data-testid="align-left"
        />
        {TextAlignLeftIcon}
      </label>
    );
  },
});

export const actionChangeTextAlignRight = register({
  name: "changeTextAlignRight",
  label: t("labels.alignTextRight"),
  trackEvent: false,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.R,
  perform: (elements, appState, _, app) =>
    alignTextElements(elements, appState, app, "right"),
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const selectedTextAlign = getFormValue(
      elements,
      appState,
      (element) => {
        if (isTextElement(element)) {
          return element.textAlign;
        }
        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          return boundTextElement.textAlign;
        }
        return null;
      },
      (element) =>
        isTextElement(element) ||
        getBoundTextElement(element, elementsMap) !== null,
      (hasSelection) => (hasSelection ? null : appState.currentItemTextAlign),
    );
    return (
      <label
        key={t("labels.right")}
        className={clsx({ active: selectedTextAlign === "right" })}
        title={t("labels.right")}
      >
        <input
          type="radio"
          name="text-align"
          onChange={() => updateData("right")}
          checked={selectedTextAlign === "right"}
          data-testid="align-right"
        />
        {TextAlignRightIcon}
      </label>
    );
  },
});

export const actionChangeTextAlignCenter = register({
  name: "changeTextAlignCenter",
  label: t("labels.alignTextCenter"),
  trackEvent: false,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.T,
  perform: (elements, appState, _, app) =>
    alignTextElements(elements, appState, app, "center"),
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const selectedTextAlign = getFormValue(
      elements,
      appState,
      (element) => {
        if (isTextElement(element)) {
          return element.textAlign;
        }
        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          return boundTextElement.textAlign;
        }
        return null;
      },
      (element) =>
        isTextElement(element) ||
        getBoundTextElement(element, elementsMap) !== null,
      (hasSelection) => (hasSelection ? null : appState.currentItemTextAlign),
    );
    return (
      <label
        key={t("labels.center")}
        className={clsx({ active: selectedTextAlign === "center" })}
        title={t("labels.center")}
      >
        <input
          type="radio"
          name="text-align"
          onChange={() => updateData("center")}
          checked={selectedTextAlign === "center"}
          data-testid="align-horizontal-center"
        />
        {TextAlignCenterIcon}
      </label>
    );
  },
});
