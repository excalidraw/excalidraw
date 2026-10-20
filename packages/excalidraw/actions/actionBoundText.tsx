import {
  BOUND_TEXT_PADDING,
  ROUNDNESS,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  arrayToMap,
  isTransparent,
} from "@excalidraw/common";
import {
  getOriginalContainerHeightFromCache,
  isBoundToContainer,
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "@excalidraw/element";

import {
  DEFAULT_BOUND_TEXT_LABEL_POSITION,
  computeBoundTextPosition,
  computeContainerDimensionForBoundText,
  getBoundTextElement,
  normalizeStickyNoteFontSize,
  redrawTextBoundingBox,
  updateStickyNoteLayout,
} from "@excalidraw/element";

import {
  hasBoundTextElement,
  isArrowElement,
  isStickyNoteElement,
  isTextBindableContainer,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import { getNonDeletedElements } from "@excalidraw/element";

import { syncMovedIndices } from "@excalidraw/element";

import { newElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { Scene } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { Radians } from "@excalidraw/math";

import { getDefaultAppState } from "../appState";
import { getSelectionStateForElements } from "../components/App.selection";

import { register } from "./register";

import type { ActionResult } from "./types";
import type { AppClassProperties, AppState } from "../types";

/**
 * Frees the container's text as it rendered: wrapped the same, at a fixed
 * width.
 */
export const unbindTextFromContainer = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
  scene: Scene,
) => {
  const { x, y } = computeBoundTextPosition(
    container,
    boundTextElement,
    scene.getNonDeletedElementsMap(),
  );
  scene.mutateElement(boundTextElement as ExcalidrawTextElement, {
    containerId: null,
    autoResize: false,
    baseFontSize: null,
    x,
    y,
    labelPosition: null,
  });
  scene.mutateElement(container, {
    boundElements: container.boundElements?.filter(
      (ele) => ele.id !== boundTextElement.id,
    ),
  });
};

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
    const freedTextElements: NonDeletedExcalidrawElement[] = [];
    selectedElements.forEach((element) => {
      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement) {
        freedTextElements.push(boundTextElement);
        const originalContainerHeight = getOriginalContainerHeightFromCache(
          element.id,
        );
        resetOriginalContainerCache(element.id);
        unbindTextFromContainer(element, boundTextElement, app.scene);
        if (isStickyNoteElement(element)) {
          // an empty note sits at its base height; bound arrows follow
          updateStickyNoteLayout(element, app.scene, {
            renderEnvironment: app.renderEnvironment,
          });
        } else {
          app.scene.mutateElement(element, {
            height: originalContainerHeight
              ? originalContainerHeight
              : element.height,
          });
        }
      }
    });
    return {
      elements,
      appState: {
        ...appState,
        // the freed texts stay selected along with their former containers
        ...getSelectionStateForElements(
          [...selectedElements, ...freedTextElements],
          getNonDeletedElements(elements),
          appState,
        ),
      },
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
    let container: NonDeleted<ExcalidrawTextContainer>;

    if (
      isTextElement(selectedElements[0]) &&
      isTextBindableContainer(selectedElements[1])
    ) {
      textElement = selectedElements[0];
      container = selectedElements[1];
    } else {
      textElement = selectedElements[1] as ExcalidrawTextElement;
      container = selectedElements[0] as NonDeleted<ExcalidrawTextContainer>;
    }

    return bindTextToContainer(elements, appState, textElement, container, app);
  },
});

/**
 * A note and its label share one ink: the text the user styled wins, unless it
 * is transparent (a note's label never is).
 */
export const getStickyNoteInk = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawElement,
) =>
  isStickyNoteElement(container)
    ? isTransparent(textElement.strokeColor)
      ? container.strokeColor
      : textElement.strokeColor
    : null;

/** binds the text to the (label-less) container, selecting the container */
export const bindTextToContainer = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  textElement: ExcalidrawTextElement,
  container: NonDeleted<ExcalidrawTextContainer>,
  app: AppClassProperties,
): ActionResult => {
  const stickyInk = getStickyNoteInk(textElement, container);
  app.scene.mutateElement(textElement, {
    containerId: container.id,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    textAlign: TEXT_ALIGN.CENTER,
    autoResize: true,
    angle: (isArrowElement(container) ? 0 : container?.angle ?? 0) as Radians,
    labelPosition: isArrowElement(container)
      ? DEFAULT_BOUND_TEXT_LABEL_POSITION
      : null,
    ...(stickyInk
      ? {
          baseFontSize: normalizeStickyNoteFontSize(
            textElement.baseFontSize ?? textElement.fontSize,
          ),
          strokeColor: stickyInk,
        }
      : null),
  });
  app.scene.mutateElement(container, {
    boundElements: (container.boundElements || []).concat({
      type: "text",
      id: textElement.id,
    }),
    // the footer paints with the note's ink
    ...(stickyInk ? { strokeColor: stickyInk } : null),
  });
  const originalContainerHeight = container.height;
  redrawTextBoundingBox(
    textElement,
    container,
    app.scene,
    app.renderEnvironment,
  );
  // overwritting the cache with original container height so
  // it can be restored when unbind
  updateOriginalContainerCache(container.id, originalContainerHeight);

  const nextElements = pushTextAboveContainer(elements, container, textElement);

  return {
    elements: nextElements,
    appState: {
      ...appState,
      // with the line editor of an arrow
      ...getSelectionStateForElements(
        [container],
        getNonDeletedElements(nextElements),
        appState,
      ),
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

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

export const pushContainerBelowText = (
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
  perform: (elements, appState, _, app) =>
    wrapTextsInContainers(
      elements,
      appState,
      app.scene
        .getSelectedElements(appState)
        .filter(
          (element): element is NonDeleted<ExcalidrawTextElement> =>
            isTextElement(element) && !isBoundToContainer(element),
        ),
      app,
    ),
});

/** wraps each (unbound) text in a new container, selecting the containers */
export const wrapTextsInContainers = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  textElements: readonly ExcalidrawTextElement[],
  app: AppClassProperties,
): ActionResult => {
  let updatedElements: readonly ExcalidrawElement[] = elements.slice();
  const containerIds: Mutable<AppState["selectedElementIds"]> = {};

  for (const textElement of textElements) {
    // a default rectangle (not the current item's style), drawn in the
    // text's color
    const container = newElement({
      type: "rectangle",
      boundElements: [
        ...(textElement.boundElements || []),
        { id: textElement.id, type: "text" },
      ],
      angle: textElement.angle,
      strokeColor: textElement.strokeColor,
      roundness:
        getDefaultAppState().currentItemRoundness === "round"
          ? {
              type: isUsingAdaptiveRadius("rectangle")
                ? ROUNDNESS.ADAPTIVE_RADIUS
                : ROUNDNESS.PROPORTIONAL_RADIUS,
            }
          : null,
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

    redrawTextBoundingBox(
      textElement,
      container,
      app.scene,
      app.renderEnvironment,
    );

    updatedElements = pushContainerBelowText(
      [...updatedElements, container],
      container,
      textElement,
    );

    containerIds[container.id] = true;
  }

  return {
    elements: updatedElements,
    appState: {
      ...appState,
      selectedElementIds: containerIds,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};
