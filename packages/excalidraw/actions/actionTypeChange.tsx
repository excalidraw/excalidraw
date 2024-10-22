import { ButtonIconSelect } from "../components/ButtonIconSelect";

import { DiamondIcon, EllipseIcon, RectangleIcon } from "../components/icons";

import { newElement, redrawTextBoundingBox } from "../element";

import { isFlowchartNodeElement } from "../element/typeChecks";
import type { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { KEYS } from "../keys";

import { randomInteger } from "../random";
import { StoreAction } from "../store";
import type { AppClassProperties, AppState } from "../types";
import { changeProperty, getFormValue } from "./actionProperties";
import { register } from "./register";

const changeShapeForAllSelected = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  value: "rectangle" | "diamond" | "ellipse",
  app: AppClassProperties,
) => {
  const newElements = changeProperty(elements, appState, (el) => {
    if (el.type !== value && isFlowchartNodeElement(el)) {
      if (el.roundness && el.roundness.type >= 2) {
        const newShape = newElement({
          ...el,
          width: el.width,
          height: el.height,
          type: value,
          roundness: { type: 2, value: el.roundness.value },
          versionNonce: randomInteger(),
        });
        return newShape;
      }
      const newShape = newElement({
        ...el,
        width: el.width,
        height: el.height,
        type: value,
        versionNonce: randomInteger(),
      });
      return newShape;
    }
    return el;
  });
  newElements.forEach((ele) => {
    if (ele.type === "text" && ele.containerId) {
      const container = newElements.find((e) => e.id === ele.containerId);
      if (container === undefined) {
        return;
      }
      redrawTextBoundingBox(
        ele,
        container,
        app.scene.getNonDeletedElementsMap(),
      );
    }
  });

  return {
    elements: newElements,
    storeAction: StoreAction.CAPTURE,
  };
};
export const actionChangeShapeType = register({
  name: "changeShapeType",
  label: "labels.shapeType",
  trackEvent: { category: "element", action: "changeShapeForAllSelected" },
  perform: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    value: "rectangle" | "diamond" | "ellipse",
    app: AppClassProperties,
  ) => {
    const newElements = changeProperty(elements, appState, (el) => {
      if (el.type !== value && isFlowchartNodeElement(el)) {
        if (el.roundness && el.roundness.type >= 2) {
          const newShape = newElement({
            ...el,
            width: el.width,
            height: el.height,
            type: value,
            roundness: { type: 2, value: el.roundness.value },
            versionNonce: randomInteger(),
          });
          return newShape;
        }
        const newShape = newElement({
          ...el,
          width: el.width,
          height: el.height,
          type: value,
          versionNonce: randomInteger(),
        });
        return newShape;
      }
      return el;
    });
    newElements.forEach((ele) => {
      if (ele.type === "text" && ele.containerId) {
        const container = newElements.find((e) => e.id === ele.containerId);
        if (container === undefined) {
          return;
        }
        redrawTextBoundingBox(
          ele,
          container,
          app.scene.getNonDeletedElementsMap(),
        );
      }
    });

    return {
      elements: newElements,
      storeAction: StoreAction.CAPTURE,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <fieldset>
      <legend>{t("labels.changeShapesTypes")}</legend>
      <ButtonIconSelect
        group="shapeType"
        options={[
          {
            value: "rectangle",
            text: t("labels.changeToRectangle"),
            icon: RectangleIcon,
            testId: "sharp-rectangle",
          },
          {
            value: "diamond",
            text: t("labels.changeToDiamond"),
            icon: DiamondIcon,
            testId: "sharp-rectangle",
          },
          {
            value: "ellipse",
            text: t("labels.changeToEllipse"),
            icon: EllipseIcon,
            testId: "elbow-arrow",
          },
        ]}
        aria-label={t("labels.changeToRectangle")}
        value={getFormValue(
          elements,
          appState,
          (element) => {
            if (isFlowchartNodeElement(element)) {
              return element.type;
            }
            return null;
          },
          (element) => isFlowchartNodeElement(element),
          (hasSelection) =>
            hasSelection ? null : appState.currentItemArrowType,
        )}
        onChange={(value) => updateData(value)}
      />
    </fieldset>
  ),
});

export const actionChangeToRectangle = register({
  name: "changeToRectangle",
  label: "labels.changeToRectangle",
  trackEvent: { category: "element", action: "changeToRectangle" },
  perform: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    app: AppClassProperties,
  ) => {
    return changeShapeForAllSelected(elements, appState, "rectangle", app);
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS[2],
});

export const actionChangeToDiamond = register({
  name: "changeToDiamond",
  label: "labels.changeToDiamond",
  trackEvent: { category: "element", action: "changeToDiamond" },
  perform: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    value: "diamond",
    app: AppClassProperties,
  ) => {
    return changeShapeForAllSelected(elements, appState, "diamond", app);
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS[3],
});

export const actionChangeToEllipse = register({
  name: "changeToEllipse",
  label: "labels.changeToEllipse",
  trackEvent: { category: "element", action: "changeToEllipse" },
  perform: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    value: "ellipse",
    app: AppClassProperties,
  ) => {
    return changeShapeForAllSelected(elements, appState, "ellipse", app);
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS[4],
});
