import {
  BOUND_TEXT_PADDING,
  ROUNDNESS,
  VERTICAL_ALIGN,
  TEXT_ALIGN,
} from "../constants";
import { isTextElement, newElement } from "../element";
import { mutateElement } from "../element/mutateElement";
import {
  computeBoundTextPosition,
  computeContainerDimensionForBoundText,
  getBoundTextElement,
  measureText,
  redrawTextBoundingBox,
} from "../element/textElement";
import {
  getOriginalContainerHeightFromCache,
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "../element/textWysiwyg";
import {
  hasBoundTextElement,
  isTextBindableContainer,
  isUsingAdaptiveRadius,
} from "../element/typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
} from "../element/types";
import { AppState } from "../types";
import { Mutable } from "../utility-types";
import { getFontString } from "../utils";
import { register } from "./register";

export const actionUnbindText = register({
  name: "unbindText",
  contextItemLabel: "labels.unbindText",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);

    return selectedElements.some((element) => hasBoundTextElement(element));
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    selectedElements.forEach((element) => {
      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        const { width, height, baseline } = measureText(
          boundTextElement.originalText,
          getFontString(boundTextElement),
          boundTextElement.lineHeight,
        );
        const originalContainerHeight = getOriginalContainerHeightFromCache(
          element.id,
        );
        resetOriginalContainerCache(element.id);
        const { x, y } = computeBoundTextPosition(element, boundTextElement);
        mutateElement(boundTextElement as ExcalidrawTextElement, {
          containerId: null,
          width,
          height,
          baseline,
          text: boundTextElement.originalText,
          x,
          y,
        });
        mutateElement(element, {
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
      commitToHistory: true,
    };
  },
});

export const actionBindText = register({
  name: "bindText",
  contextItemLabel: "labels.bindText",
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
        getBoundTextElement(bindingContainer) === null
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
    mutateElement(textElement, {
      containerId: container.id,
      verticalAlign: VERTICAL_ALIGN.MIDDLE,
      textAlign: TEXT_ALIGN.CENTER,
    });
    mutateElement(container, {
      boundElements: (container.boundElements || []).concat({
        type: "text",
        id: textElement.id,
      }),
    });
    const originalContainerHeight = container.height;
    redrawTextBoundingBox(textElement, container);
    // overwritting the cache with original container height so
    // it can be restored when unbind
    updateOriginalContainerCache(container.id, originalContainerHeight);

    return {
      elements: pushTextAboveContainer(elements, container, textElement),
      appState: { ...appState, selectedElementIds: { [container.id]: true } },
      commitToHistory: true,
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
  return updatedElements;
};

export const actionWrapTextInContainer = register({
  name: "wrapTextInContainer",
  contextItemLabel: "labels.createContainerFromText",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const areTextElements = selectedElements.every((el) => isTextElement(el));
    return selectedElements.length > 0 && areTextElements;
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    let updatedElements: readonly ExcalidrawElement[] = elements.slice();
    const containerIds: Mutable<AppState["selectedElementIds"]> = {};

    for (const textElement of selectedElements) {
      if (isTextElement(textElement)) {
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
              mutateElement(ele, { startBinding, endBinding }, false);
            }
          });
        }

        mutateElement(
          textElement,
          {
            containerId: container.id,
            verticalAlign: VERTICAL_ALIGN.MIDDLE,
            boundElements: null,
            textAlign: TEXT_ALIGN.CENTER,
          },
          false,
        );
        redrawTextBoundingBox(textElement, container);

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
      commitToHistory: true,
    };
  },
});
