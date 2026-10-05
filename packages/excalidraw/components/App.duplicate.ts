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
  advanceDuplicatedListMarkers,
  applyListMarkerAdvances,
  deepCopyElement,
  duplicateElements,
  filterElementsEligibleAsFrameChildren,
  getCommonBounds,
  getSelectionStateForElements,
  isBindableElement,
  isLinearElement,
  isTextElement,
  LinearElementEditor,
  newElementWith,
  reconcileDuplicatedElements,
  syncMovedIndices,
  updateBoundElements,
} from "@excalidraw/element";

import type { ListMarkerAdvance } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

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
  constructor(
    private app: App,
    private dependencies: {
      /** pointers currently down */
      getPointerCount: () => number;
    },
  ) {}

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
   * Runs `update` once what's pending is committed, capturing what it changes
   * (if it returns `true`) as a separate undo step.
   */
  private afterCommit(update: () => boolean) {
    // (setState callbacks run after componentDidUpdate, which commits)
    this.app.setState({}, () => {
      if (update()) {
        this.app.store.scheduleCapture();
      }
    });
  }

  /**
   * Advances the list markers of the duplicated texts (`1.` -> `2.`) once
   * the duplication is committed, as a separate undo step, so that undo
   * reverts the markers first.
   */
  advanceListMarkers = (duplicatedElements: readonly ExcalidrawElement[]) => {
    this.afterCommit(() => {
      const duplicates = duplicatedElements.flatMap(
        (element) => this.app.scene.getNonDeletedElement(element.id) ?? [],
      );

      return (
        advanceDuplicatedListMarkers(duplicates, this.app.scene).length > 0
      );
    });
  };

  /**
   * The text whose editing an alt-press on it ended, while the press is
   * handed over to the canvas (see `handOverTextEditorPress()`).
   */
  handedOverTextId: ExcalidrawTextElement["id"] | null = null;

  /**
   * An alt-press on the text being edited, once it ended the editing, is
   * handed over to the canvas, for the text to be alt-dragged (duplicated) as
   * on the canvas — its duplicate is then edited on drop.
   */
  handOverTextEditorPress = (
    event: PointerEvent,
    textElementId: ExcalidrawTextElement["id"],
  ) => {
    this.handedOverTextId = textElementId;
    try {
      this.app.interactiveCanvas?.dispatchEvent(
        new this.app.ownerWindow.PointerEvent(event.type, event),
      );
    } finally {
      this.handedOverTextId = null;
    }
  };

  /**
   * The pointer down a handed-over press is replayed as (see
   * `handOverTextEditorPress()`) moves what was edited — the text, or its
   * container — and nothing beneath the editor, which reaches past the text:
   * no resize handle, nor an arrow's point, midpoint or label.
   *
   * @returns `false` if the pointer down isn't a handed-over press
   */
  hitEditedElement = (pointerDownState: PointerDownState): boolean => {
    const { editedTextId } = pointerDownState.hit;
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const text = editedTextId && this.app.scene.getElement(editedTextId);
    // (the text is gone if emptied)
    const element =
      text && isTextElement(text)
        ? elementsMap.get(text.containerId ?? text.id)
        : null;
    if (!element) {
      return false;
    }

    pointerDownState.hit.element = element;
    pointerDownState.hit.allHitElements = [element];

    // a fresh arrow editor, as the last press' (on a point, the midpoint or
    // the label) would drive the drag
    if (this.app.state.selectedLinearElement) {
      this.app.setState({
        selectedLinearElement: isLinearElement(element)
          ? new LinearElementEditor(element, elementsMap)
          : null,
      });
    }

    return true;
  };

  /**
   * On alt-drag drop: the list markers advanced along with the drag go back,
   * for the drag to be committed as is, and forth again once it is, as
   * a separate undo step (before the browser gets to paint either).
   *
   * A duplicate is then edited (once the drop is committed): a single list
   * item with text after its marker, with that text selected (`1. |foo|`),
   * as it's likely to differ from the original's — or else the duplicate of
   * the text the drag ended the editing of, with all of it selected.
   */
  commitDraggedDuplicates = (
    { hit }: PointerDownState,
    {
      editText,
    }: {
      /** `false` if the drag didn't end with a genuine pointerup */
      editText: boolean;
    },
  ) => {
    const advances = hit.advancedListMarkers;
    const [advance] = advances;
    const listItem =
      advances.length === 1 &&
      advance.contentStart < advance.nextOriginalText.length
        ? advance
        : null;
    const textToEditId = !editText
      ? null
      : listItem
      ? listItem.elementId
      : hit.editedTextId;

    const editTextOnceCommitted = () => {
      if (textToEditId) {
        this.afterCommit(() => {
          this.editDuplicatedText(textToEditId, listItem);
          return false;
        });
      }
    };

    if (!advances.length) {
      editTextOnceCommitted();
      return;
    }

    applyListMarkerAdvances(advances, "prev", this.app.scene);

    this.afterCommit(() => {
      applyListMarkerAdvances(advances, "next", this.app.scene);
      editTextOnceCommitted();
      return true;
    });
  };

  private editDuplicatedText(
    elementId: ExcalidrawTextElement["id"],
    /** to select the item's text only */
    listItem: ListMarkerAdvance | null,
  ) {
    const element = this.app.scene.getNonDeletedElement(elementId);
    if (
      !element ||
      !isTextElement(element) ||
      (listItem && element.originalText !== listItem.nextOriginalText) ||
      // another interaction has started
      this.dependencies.getPointerCount() > 0
    ) {
      return;
    }

    this.app.text.startTextEditing({
      sceneX: element.x,
      sceneY: element.y,
      insertAtParentCenter: false,
      textElement: element,
      initialSelection: {
        start: listItem?.contentStart ?? 0,
        end: element.originalText.length,
      },
    });
  }

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
      pointerDownState.hit.editedTextId = null;
      return;
    }

    // (originals whose duplicates were vetoed are left behind)
    const duplicateElementsMap = arrayToMap(duplicatedElements);

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
      // swap the edited text with its duplicate
      if (pointerDownState.hit.editedTextId) {
        const cloneId = origIdToDuplicateId.get(
          pointerDownState.hit.editedTextId,
        );
        pointerDownState.hit.editedTextId =
          (cloneId && duplicateElementsMap.get(cloneId)?.id) || null;
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

      // visible from the start of the drag, captured on drop (see
      // `commitDraggedDuplicates()`)
      pointerDownState.hit.advancedListMarkers = advanceDuplicatedListMarkers(
        duplicatedElements,
        this.app.scene,
      );

      // (after advancing the list markers, which may resize the duplicates)
      duplicatedElements.forEach((element) => {
        pointerDownState.originalElements.set(
          element.id,
          deepCopyElement(element),
        );
      });

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
