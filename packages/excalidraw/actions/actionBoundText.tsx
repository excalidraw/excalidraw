import {
  BOUND_TEXT_PADDING,
  ROUNDNESS,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  arrayToMap,
  getFontString,
} from "@excalidraw/common";
import {
  getOriginalContainerHeightFromCache,
  isBoundToContainer,
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "@excalidraw/element";

import {
  computeBoundTextPosition,
  computeContainerDimensionForBoundText,
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import {
  hasBoundTextElement,
  isArrowElement,
  isTextBindableContainer,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import { measureText } from "@excalidraw/element";

import { syncMovedIndices } from "@excalidraw/element";

import { newElementWith } from "@excalidraw/element";

import { newElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeleted,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { Radians } from "@excalidraw/math";

import { register } from "./register";

import type { AppState } from "../types";
import { AppClassProperties } from "../types";

export const actionUnbindText = register({
  name: "unbindText",
  label: "labels.unbindText",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);

    return selectedElements.some((element) => hasBoundTextElement(element));
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const elementsMap = app.scene.getNonDeletedElementsMap();
    selectedElements.forEach((element) => {
      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement) {
        const { width, height } = measureText(
          boundTextElement.originalText,
          getFontString(boundTextElement),
          boundTextElement.lineHeight,
        );
        const originalContainerHeight = getOriginalContainerHeightFromCache(
          element.id,
        );
        resetOriginalContainerCache(element.id);
        const { x, y } = computeBoundTextPosition(
          element,
          boundTextElement,
          elementsMap,
        );
        app.scene.mutateElement(boundTextElement as ExcalidrawTextElement, {
          containerId: null,
          width,
          height,
          text: boundTextElement.originalText,
          x,
          y,
        });
        app.scene.mutateElement(element, {
          boundElements: element.boundElements?.filter(
            (ele) => ele.id !== boundTextElement.id,
          ),
          height: originalContainerHeight
            ? originalContainerHeight
            : element.height,
        });
      }
    });
    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionBindText = register({
  name: "bindText",
  label: "labels.bindText",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);

    if (selectedElements.length === 2) {
      const textElement =
        isTextElement(selectedElements[0]) ||
        isTextElement(selectedElements[1]);

      let bindingContainer;
      if (isTextBindableContainer(selectedElements[0])) {
        bindingContainer = selectedElements[0];
      } else if (isTextBindableContainer(selectedElements[1])) {
        bindingContainer = selectedElements[1];
      }
      if (
        textElement &&
        bindingContainer &&
        getBoundTextElement(
          bindingContainer,
          app.scene.getNonDeletedElementsMap(),
        ) === null
      ) {
        return true;
      }
    }
    return false;
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);

    let textElement: ExcalidrawTextElement;
    let container: ExcalidrawTextContainer;

    if (
      isTextElement(selectedElements[0]) &&
      isTextBindableContainer(selectedElements[1])
    ) {
      textElement = selectedElements[0];
      container = selectedElements[1];
    } else {
      textElement = selectedElements[1] as ExcalidrawTextElement;
      container = selectedElements[0] as ExcalidrawTextContainer;
    }
    app.scene.mutateElement(textElement, {
      containerId: container.id,
      verticalAlign: VERTICAL_ALIGN.MIDDLE,
      textAlign: TEXT_ALIGN.CENTER,
      autoResize: true,
      angle: (isArrowElement(container) ? 0 : container?.angle ?? 0) as Radians,
    });
    app.scene.mutateElement(container, {
      boundElements: (container.boundElements || []).concat({
        type: "text",
        id: textElement.id,
      }),
    });
    const originalContainerHeight = container.height;
    redrawTextBoundingBox(textElement, container, app.scene);
    // overwritting the cache with original container height so
    // it can be restored when unbind
    updateOriginalContainerCache(container.id, originalContainerHeight);

    return {
      elements: pushTextAboveContainer(elements, container, textElement),
      appState: { ...appState, selectedElementIds: { [container.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

const pushTextAboveContainer = (
  elements: readonly ExcalidrawElement[],
  container: ExcalidrawElement,
  textElement: ExcalidrawTextElement,
) => {
  const updatedElements = elements.slice();
  const textElementIndex = updatedElements.findIndex(
    (ele) => ele.id === textElement.id,
  );
  updatedElements.splice(textElementIndex, 1);

  const containerIndex = updatedElements.findIndex(
    (ele) => ele.id === container.id,
  );
  updatedElements.splice(containerIndex + 1, 0, textElement);
  syncMovedIndices(updatedElements, arrayToMap([container, textElement]));

  return updatedElements;
};

const pushContainerBelowText = (
  elements: readonly ExcalidrawElement[],
  container: ExcalidrawElement,
  textElement: ExcalidrawTextElement,
) => {
  const updatedElements = elements.slice();
  const containerIndex = updatedElements.findIndex(
    (ele) => ele.id === container.id,
  );
  updatedElements.splice(containerIndex, 1);

  const textElementIndex = updatedElements.findIndex(
    (ele) => ele.id === textElement.id,
  );
  updatedElements.splice(textElementIndex, 0, container);
  syncMovedIndices(updatedElements, arrayToMap([container, textElement]));

  return updatedElements;
};

export const actionWrapTextInContainer = register({
  name: "wrapTextInContainer",
  label: "labels.createContainerFromText",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    console.log("wrapTextInContainer predicate:", selectedElements, selectedElements.some(el => isTextElement(el) && !isBoundToContainer(el)));
    return selectedElements.some(
      (el) => isTextElement(el) && !isBoundToContainer(el),
    );
  },
  perform: (
    elements,
    appState,
    _,
    app: AppClassProperties,
  ): {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    captureUpdate: "IMMEDIATELY";
  } => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const textElements = selectedElements.filter(
      (el): el is NonDeleted<ExcalidrawTextElement> =>
        isTextElement(el) && !isBoundToContainer(el),
    );

    const elementsMap = arrayToMap(elements as readonly ExcalidrawElement[]);

    const createdContainerIds: { [id: string]: true } = {};

    const newElements = elements.flatMap((element): readonly ExcalidrawElement[] => {
      if (!textElements.includes(element as ExcalidrawTextElement)) {
        return [element];
      }
      const textElement = element as ExcalidrawTextElement;
      const container = newElement({
        type: "rectangle",
        backgroundColor: appState.currentItemBackgroundColor,
        boundElements: [
          ...(textElement.boundElements || []),
          { id: textElement.id, type: "text" },
        ],
        angle: textElement.angle,
        fillStyle: appState.currentItemFillStyle,
        strokeColor: appState.currentItemStrokeColor,
        roughness: appState.currentItemRoughness,
        strokeWidth: appState.currentItemStrokeWidth,
        strokeStyle: appState.currentItemStrokeStyle,
        roundness:
          appState.currentItemRoundness === "round"
            ? {
                type: isUsingAdaptiveRadius("rectangle")
                  ? ROUNDNESS.ADAPTIVE_RADIUS
                  : ROUNDNESS.PROPORTIONAL_RADIUS,
              }
            : null,
        opacity: 100,
        locked: false,
        x: textElement.x - BOUND_TEXT_PADDING,
        y: textElement.y - BOUND_TEXT_PADDING,
        width: computeContainerDimensionForBoundText(
          textElement.width,
          "rectangle",
        ),
        height: computeContainerDimensionForBoundText(
          textElement.height,
          "rectangle",
        ),
        groupIds: textElement.groupIds,
        frameId: textElement.frameId,
      });

      createdContainerIds[container.id] = true;

      const newTextElement = newElementWith(textElement, {
        containerId: container.id,
        verticalAlign: VERTICAL_ALIGN.MIDDLE,
        boundElements: null,
        textAlign: TEXT_ALIGN.CENTER,
        autoResize: true,
      });

      redrawTextBoundingBox(
        newTextElement as ExcalidrawTextElement,
        container,
        app.scene,
      );
      const boundLinearElements = (textElement.boundElements || [])
        .map((binding) => {
          if (binding.type === "arrow") {
            const linearElement = elementsMap.get(
              binding.id,
            ) as ExcalidrawLinearElement;

            if (linearElement) {
              const { startBinding, endBinding } = linearElement;

              return newElementWith(linearElement, {
                startBinding:
                  startBinding?.elementId === element.id
                    ? { ...startBinding, elementId: container.id }
                    : startBinding,
                endBinding:
                  endBinding?.elementId === element.id
                    ? { ...endBinding, elementId: container.id }
                    : endBinding,
              });
            }
          }
          return null;
        })
        .filter((el): el is ExcalidrawLinearElement => el !== null);

      return [container, newTextElement, ...boundLinearElements];
    });

    return {
      elements: newElements,
      appState: {
        ...appState,
        selectedElementIds: createdContainerIds,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});