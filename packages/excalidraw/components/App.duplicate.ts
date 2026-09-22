import { flushSync } from "react-dom";

import {
  arrayToMap,
  distance,
  getGridPoint,
  randomInteger,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  addElementsToFrame,
  deepCopyElement,
  duplicateElements,
  filterElementsEligibleAsFrameChildren,
  getCommonBounds,
  getSelectionStateForElements,
  isBindableElement,
  newElementWith,
  reconcileDuplicatedElements,
  syncMovedIndices,
  updateBoundElements,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { PointerDownState } from "../types";

import type App from "./App";

type Duplication = Pick<
  ReturnType<typeof duplicateElements>,
  | "duplicatedElements"
  | "duplicateElementsMap"
  | "origElementsMap"
  | "origIdToDuplicateId"
  | "duplicateIdToOrigId"
>;

/**
 * Owns the duplication paths which involve the host (`props.onDuplicate`):
 * duplicating elements into the scene (paste, library insert etc.), and
 * duplicating the dragged selection (alt-drag). The duplicate action shares
 * `runOnDuplicate()`.
 */
export class AppDuplicate {
  constructor(private app: App) {}

  /**
   * Hands the duplication over to the host's `props.onDuplicate` (if any),
   * and reconciles what it returned with the duplicates.
   *
   * @returns next elements, and the duplicates that weren't vetoed
   */
  runOnDuplicate = (
    duplication: Duplication,
    nextElements: ExcalidrawElement[],
    /** excludes the duplicated elements */
    prevElements: readonly ExcalidrawElement[],
  ) => {
    return reconcileDuplicatedElements(
      this.app.props.onDuplicate?.(nextElements, prevElements, {
        duplicateElements: duplication.duplicateElementsMap,
        originalElements: duplication.origElementsMap,
        origIdToDuplicateId: duplication.origIdToDuplicateId,
        duplicateIdToOrigId: duplication.duplicateIdToOrigId,
      }),
      nextElements,
      duplication.duplicatedElements,
    );
  };

  /**
   * Duplicates elements so that they end up centered at the scene coords
   * (and in the frame at that point, if any). Doesn't update the scene.
   *
   * @returns `null` if the host vetoed the duplication
   */
  duplicateAtSceneCoords = (
    elements: readonly ExcalidrawElement[],
    { x, y }: { x: number; y: number },
    opts?: {
      retainSeed?: boolean;
      preserveFrameChildrenOrder?: boolean;
    },
  ) => {
    const [minX, minY, maxX, maxY] = getCommonBounds(elements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;

    const [gridX, gridY] = getGridPoint(
      dx,
      dy,
      this.app.getEffectiveGridSize(),
    );

    const duplication = duplicateElements({
      type: "everything",
      elements: elements.map((element) => {
        return newElementWith(element, {
          x: element.x + gridX - minX,
          y: element.y + gridY - minY,
        });
      }),
      randomizeSeed: !opts?.retainSeed,
      preserveFrameChildrenOrder: opts?.preserveFrameChildrenOrder,
    });
    let { duplicatedElements } = duplication;

    const prevElements = this.app.scene.getElementsIncludingDeleted();
    let nextElements: ExcalidrawElement[] = [
      ...prevElements,
      ...duplicatedElements,
    ];

    syncMovedIndices(nextElements, arrayToMap(duplicatedElements));

    // resolved ahead of `onDuplicate` so that the host sees the duplicates
    // the way they end up in the scene
    const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords({ x, y });

    if (topLayerFrame) {
      const eligibleElements = filterElementsEligibleAsFrameChildren(
        duplicatedElements,
        topLayerFrame,
      );
      nextElements = addElementsToFrame(
        nextElements,
        eligibleElements,
        topLayerFrame,
      );
    }

    if (this.app.props.onDuplicate) {
      ({ elements: nextElements, duplicatedElements } = this.runOnDuplicate(
        duplication,
        nextElements,
        prevElements,
      ));

      // host vetoed the duplication
      if (!duplicatedElements.length) {
        return null;
      }

      // host may have reordered the elements
      syncMovedIndices(nextElements, arrayToMap(duplicatedElements));
    }

    return { nextElements, duplicatedElements };
  };

  /**
   * Duplicates the selection being dragged: the originals go back to where
   * the drag started, and the drag continues with the duplicates.
   *
   * If the host vetoes the duplication, the originals keep being dragged.
   */
  duplicateDraggedSelection = (
    pointerDownState: PointerDownState,
    event: PointerEvent,
  ) => {
    // Move the currently selected elements to the top of the z index stack, and
    // put the duplicates where the selected elements used to be.
    // (the origin point where the dragging started)

    pointerDownState.hit.hasBeenDuplicated = true;

    const elements = this.app.scene.getElementsIncludingDeleted();
    const hitElement = pointerDownState.hit.element;
    const selectedElements = this.app.scene.getSelectedElements({
      selectedElementIds: this.app.state.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });
    if (
      hitElement &&
      // hit element may not end up being selected
      // if we're alt-dragging a common bounding box
      // over the hit element
      pointerDownState.hit.wasAddedToSelection &&
      !selectedElements.find((el) => el.id === hitElement.id)
    ) {
      selectedElements.push(hitElement);
    }

    const idsOfElementsToDuplicate = new Map(
      selectedElements.map((el) => [el.id, el]),
    );

    const duplication = duplicateElements({
      type: "in-place",
      elements,
      appState: this.app.state,
      randomizeSeed: true,
      idsOfElementsToDuplicate,
      overrides: ({ duplicateElement, origElement }) => {
        return {
          // reset to the original element's frameId (unless we've
          // duplicated alongside a frame in which case we need to
          // keep the duplicate frame's id) so that the element
          // frame membership is refreshed on pointerup
          // NOTE this is a hacky solution and should be done
          // differently
          frameId: duplicateElement.frameId ?? origElement.frameId,
          seed: randomInteger(),
        };
      },
    });
    const { origElementsMap, origIdToDuplicateId } = duplication;

    const mappedClonedElements = duplication.elementsWithDuplicates.map(
      (el) => {
        if (idsOfElementsToDuplicate.has(el.id)) {
          const origEl = pointerDownState.originalElements.get(el.id);

          if (origEl) {
            const resetElement = newElementWith(el, {
              x: origEl.x,
              y: origEl.y,
            });
            // so that the host gets the originals as they are in the
            // next elements
            if (origElementsMap.has(el.id)) {
              origElementsMap.set(el.id, resetElement);
            }
            return resetElement;
          }
        }
        return el;
      },
    );

    const { elements: nextElements, duplicatedElements } = this.runOnDuplicate(
      duplication,
      mappedClonedElements,
      elements,
    );

    // host vetoed the duplication, so we keep dragging the originals
    if (!duplicatedElements.length) {
      return;
    }

    // (originals whose duplicates were vetoed are left behind)
    const duplicateElementsMap = arrayToMap(duplicatedElements);

    duplicatedElements.forEach((element) => {
      pointerDownState.originalElements.set(
        element.id,
        deepCopyElement(element),
      );
    });

    const elementsWithIndices = syncMovedIndices(
      nextElements,
      duplicateElementsMap,
    );

    // we need to update synchronously so as to keep pointerDownState,
    // appState, and scene elements in sync
    flushSync(() => {
      // swap hit element with the duplicated one
      if (pointerDownState.hit.element) {
        const cloneId = origIdToDuplicateId.get(
          pointerDownState.hit.element.id,
        );
        const clonedElement = cloneId && duplicateElementsMap.get(cloneId);
        pointerDownState.hit.element = clonedElement || null;
      }
      // swap hit elements with the duplicated ones
      pointerDownState.hit.allHitElements =
        pointerDownState.hit.allHitElements.reduce(
          (acc: typeof pointerDownState.hit.allHitElements, origHitElement) => {
            const cloneId = origIdToDuplicateId.get(origHitElement.id);
            const clonedElement = cloneId && duplicateElementsMap.get(cloneId);
            if (clonedElement) {
              acc.push(clonedElement);
            }

            return acc;
          },
          [],
        );

      // update drag origin to the position at which we started
      // the duplication so that the drag offset is correct
      pointerDownState.drag.origin = viewportCoordsToSceneCoords(
        event,
        this.app.state,
      );

      // switch selected elements to the duplicated ones
      this.app.setState((prevState) => ({
        ...getSelectionStateForElements(
          duplicatedElements,
          this.app.scene.getNonDeletedElements(),
          prevState,
        ),
      }));

      this.app.scene.replaceAllElements(elementsWithIndices);
      selectedElements.forEach((element) => {
        if (
          isBindableElement(element) &&
          element.boundElements?.some((other) => other.type === "arrow")
        ) {
          updateBoundElements(element, this.app.scene);
        }
      });

      this.app.maybeCacheVisibleGaps(event, selectedElements, true);
      this.app.maybeCacheReferenceSnapPoints(event, selectedElements, true);
    });
  };
}
