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

import { newElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { Radians } from "@excalidraw/math";

import { register } from "./register";

import type { AppState } from "../types";

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
    const someTextElements = selectedElements.some(
      (el) => isTextElement(el) && !isBoundToContainer(el),
    );
    return selectedElements.length > 0 && someTextElements;
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    let updatedElements: readonly ExcalidrawElement[] = elements.slice();
    const containerIds: Mutable<AppState["selectedElementIds"]> = {};

    for (const textElement of selectedElements) {
      if (isTextElement(textElement) && !isBoundToContainer(textElement)) {
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

        // update bindings
        if (textElement.boundElements?.length) {
          const linearElementIds = textElement.boundElements
            .filter((ele) => ele.type === "arrow")
            .map((el) => el.id);
          const linearElements = updatedElements.filter((ele) =>
            linearElementIds.includes(ele.id),
          ) as ExcalidrawLinearElement[];
          linearElements.forEach((ele) => {
            let startBinding = ele.startBinding;
            let endBinding = ele.endBinding;

            if (startBinding?.elementId === textElement.id) {
              startBinding = {
                ...startBinding,
                elementId: container.id,
              };
            }

            if (endBinding?.elementId === textElement.id) {
              endBinding = { ...endBinding, elementId: container.id };
            }

            if (startBinding || endBinding) {
              app.scene.mutateElement(ele, {
                startBinding,
                endBinding,
              });
            }
          });
        }

        app.scene.mutateElement(textElement, {
          containerId: container.id,
          verticalAlign: VERTICAL_ALIGN.MIDDLE,
          boundElements: null,
          textAlign: TEXT_ALIGN.CENTER,
          autoResize: true,
        });

        redrawTextBoundingBox(textElement, container, app.scene);

        updatedElements = pushContainerBelowText(
          [...updatedElements, container],
          container,
          textElement,
        );

        containerIds[container.id] = true;
      }
    }

    return {
      elements: updatedElements,
      appState: {
        ...appState,
        selectedElementIds: containerIds,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
