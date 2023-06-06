import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { resizeMultipleElements } from "../element/resizeElements";
import { AppState, PointerDownState } from "../types";
import { arrayToMap } from "../utils";
import { CODES, KEYS } from "../keys";
import { getCommonBoundingBox } from "../element/bounds";
import {
  bindOrUnbindSelectedElements,
  isBindingEnabled,
  unbindLinearElements,
} from "../element/binding";
import {
  elementOverlapsWithFrame,
  getContainingFrame,
  removeElementsFromFrame,
} from "../frame";
import { getElementsInGroup } from "../groups";

export const actionFlipHorizontal = register({
  name: "flipHorizontal",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: updateFrameAfterFlipping(
        flipSelectedElements(elements, appState, "horizontal"),
        appState,
      ),
      appState,
      commitToHistory: true,
    };
  },
  keyTest: (event) => event.shiftKey && event.code === CODES.H,
  contextItemLabel: "labels.flipHorizontal",
});

export const actionFlipVertical = register({
  name: "flipVertical",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: updateFrameAfterFlipping(
        flipSelectedElements(elements, appState, "vertical"),
        appState,
      ),
      appState,
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event.shiftKey && event.code === CODES.V && !event[KEYS.CTRL_OR_CMD],
  contextItemLabel: "labels.flipVertical",
});

const flipSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  flipDirection: "horizontal" | "vertical",
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
    {
      includeElementsInFrames: true,
    },
  );

  const updatedElements = flipElements(
    selectedElements,
    appState,
    flipDirection,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return elements.map(
    (element) => updatedElementsMap.get(element.id) || element,
  );
};

const flipElements = (
  elements: NonDeleted<ExcalidrawElement>[],
  appState: AppState,
  flipDirection: "horizontal" | "vertical",
): ExcalidrawElement[] => {
  const { minX, minY, maxX, maxY } = getCommonBoundingBox(elements);

  resizeMultipleElements(
    { originalElements: arrayToMap(elements) } as PointerDownState,
    elements,
    "nw",
    true,
    flipDirection === "horizontal" ? maxX : minX,
    flipDirection === "horizontal" ? minY : maxY,
  );

  (isBindingEnabled(appState)
    ? bindOrUnbindSelectedElements
    : unbindLinearElements)(elements);

  return elements;
};

const updateFrameAfterFlipping = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  let nextElements = [...elements];
  const selectedElements = getSelectedElements(elements, appState);
  const groupsToRemove = new Set<string>();

  for (const element of selectedElements) {
    const containgFrame = getContainingFrame(element);

    if (containgFrame) {
      if (
        element.groupIds.length > 0 &&
        !element.groupIds.some((gid) => groupsToRemove.has(gid))
      ) {
        const allElementsInGroup = Array.from(
          new Set(
            element.groupIds.flatMap((gid) =>
              getElementsInGroup(elements, gid),
            ),
          ),
        );
        if (
          !allElementsInGroup.some((element) =>
            elementOverlapsWithFrame(element, containgFrame),
          )
        ) {
          nextElements = removeElementsFromFrame(
            nextElements,
            allElementsInGroup,
            appState,
          );
          element.groupIds.forEach((gid) => groupsToRemove.add(gid));
        }
      } else if (element.groupIds.length === 0) {
        if (!elementOverlapsWithFrame(element, containgFrame)) {
          nextElements = removeElementsFromFrame(
            nextElements,
            [element],
            appState,
          );
        }
      }
    }
  }

  return nextElements;
};
