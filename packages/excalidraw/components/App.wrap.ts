import {
  BoundElement,
  CaptureUpdateAction,
  fixBindingsAfterDeletion,
  getBoundTextElement,
  getNonDeletedElements,
  hasBoundTextElement,
  isArrowElement,
  isBoundToContainer,
  isFrameLikeElement,
  isTextBindableContainer,
  isTextElement,
  normalizeStickyNoteFontSize,
  redrawTextBoundingBox,
  updateBoundElements,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  FixedPointBinding,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import {
  bindTextToContainer,
  getStickyNoteInk,
  pushContainerBelowText,
  unbindTextFromContainer,
  wrapTextsInContainers,
} from "../actions/actionBoundText";
import {
  getFrameToUnwrap,
  unwrapFrame,
  wrapInFrame,
} from "../actions/actionFrame";

import { getSelectionStateForElements } from "./App.selection";

import type { ActionResult } from "../actions/types";
import type { AppState } from "../types";
import type App from "./App";

/** a container unwrapping removed, and how its text sat in it */
type UnwrappedContainer = {
  containerId: ExcalidrawTextContainer["id"];
  textId: ExcalidrawTextElement["id"];
  baseFontSize: ExcalidrawTextElement["baseFontSize"];
  labelPosition: ExcalidrawTextElement["labelPosition"];
  autoResize: ExcalidrawTextElement["autoResize"];
  /**
   * the freed text as it landed, to tell how far it moved since (it doesn't
   * auto-resize, so a font size change doesn't move it) and whether it was
   * resized
   */
  text: Pick<ExcalidrawTextElement, "x" | "y" | "fontSize">;
  /** the arrows bound to the container, as they were bound */
  arrows: Pick<ExcalidrawArrowElement, "id" | "startBinding" | "endBinding">[];
};

const rebind = (
  binding: FixedPointBinding | null,
  fromId: ExcalidrawElement["id"],
  toId: ExcalidrawElement["id"],
) =>
  binding?.elementId === fromId ? { ...binding, elementId: toId } : binding;

/**
 * Wraps the selection in what fits it, or unwraps it, preferring containers
 * over frames:
 *
 * 1. a text and a container without one: binds the text to the container
 * 2. texts, with any labeled containers: wraps each text in a container
 * 3. labeled containers: unwraps their texts, removing the containers
 * 4. a frame with any of its children, or all of a frame's children: removes
 *    the frame
 * 5. anything else without a frame: wraps it in a frame
 *
 * The containers (3) removed come back in place of new ones while the
 * selection it left stands, so diamonds, notes and arrows survive a toggle.
 */
export class AppWrap {
  private unwrapped: {
    selectedElementIds: AppState["selectedElementIds"];
    containers: readonly UnwrappedContainer[];
  } | null = null;

  constructor(private app: App) {}

  toggle = (
    elements: readonly ExcalidrawElement[],
    appState: Readonly<AppState>,
  ): ActionResult => {
    const unwrapped =
      this.unwrapped?.selectedElementIds === appState.selectedElementIds
        ? this.unwrapped
        : null;
    this.unwrapped = null;

    const selectedElements = this.app.scene
      .getSelectedElements(appState)
      .filter((element) => !isBoundToContainer(element));
    const texts = selectedElements.filter(
      (
        element,
      ): element is NonDeletedExcalidrawElement & ExcalidrawTextElement =>
        isTextElement(element),
    );
    const labeledContainers = selectedElements.filter((element) =>
      hasBoundTextElement(element),
    );

    if (selectedElements.length === 2 && texts.length === 1) {
      const container = selectedElements.find(
        (element) => element !== texts[0],
      )!;
      if (
        isTextBindableContainer(container) &&
        !hasBoundTextElement(container)
      ) {
        return bindTextToContainer(
          elements,
          appState,
          texts[0],
          container,
          this.app,
        );
      }
    }

    if (
      texts.length &&
      texts.length + labeledContainers.length === selectedElements.length
    ) {
      const rewrapped =
        unwrapped && this.rewrap(elements, appState, unwrapped.containers);
      if (rewrapped) {
        return rewrapped;
      }

      const result = wrapTextsInContainers(elements, appState, texts, this.app);
      return (
        result && {
          ...result,
          appState: {
            ...result.appState,
            // the labeled containers stay selected, to unwrap next along
            // with the new ones
            selectedElementIds: {
              ...result.appState?.selectedElementIds,
              ...Object.fromEntries(
                labeledContainers.map((element) => [element.id, true] as const),
              ),
            },
          },
        }
      );
    }

    if (labeledContainers.length === selectedElements.length) {
      return this.unwrap(elements, appState, labeledContainers);
    }

    const frameToUnwrap = getFrameToUnwrap(
      selectedElements,
      this.app.scene.getNonDeletedElementsMap(),
    );
    if (frameToUnwrap) {
      return unwrapFrame(elements, appState, frameToUnwrap, this.app);
    }

    if (
      selectedElements.length &&
      !selectedElements.some((element) => isFrameLikeElement(element))
    ) {
      return wrapInFrame(elements, appState, selectedElements, this.app);
    }

    return false;
  };

  /** frees the containers' texts, moving the containers' arrows onto them */
  private unwrap(
    elements: readonly ExcalidrawElement[],
    appState: Readonly<AppState>,
    containers: readonly ExcalidrawElement[],
  ): ActionResult {
    const { scene } = this.app;
    const elementsMap = scene.getNonDeletedElementsMap();
    const texts: NonDeletedExcalidrawElement[] = [];
    const unwrapped: UnwrappedContainer[] = [];

    for (const container of containers) {
      const text = getBoundTextElement(container, elementsMap);
      if (!text) {
        continue;
      }
      const arrows = (container.boundElements ?? []).flatMap(({ id }) => {
        const arrow = elementsMap.get(id);
        return arrow && isArrowElement(arrow) ? [arrow] : [];
      });

      const { baseFontSize, labelPosition, autoResize } = text;
      unbindTextFromContainer(container, text, scene);
      unwrapped.push({
        containerId: container.id,
        textId: text.id,
        baseFontSize,
        labelPosition,
        autoResize,
        text: { x: text.x, y: text.y, fontSize: text.fontSize },
        arrows: arrows.map(({ id, startBinding, endBinding }) => ({
          id,
          startBinding,
          endBinding,
        })),
      });

      if (arrows.length) {
        for (const arrow of arrows) {
          scene.mutateElement(arrow, {
            startBinding: rebind(arrow.startBinding, container.id, text.id),
            endBinding: rebind(arrow.endBinding, container.id, text.id),
          });
        }
        scene.mutateElement(text, {
          boundElements: [
            ...(text.boundElements ?? []),
            ...arrows.map(({ id }) => ({ id, type: "arrow" as const })),
          ],
        });
      }
      scene.mutateElement(container, {
        isDeleted: true,
        boundElements: container.boundElements?.filter(
          ({ id }) => !arrows.some((arrow) => arrow.id === id),
        ),
      });
      updateBoundElements(text, scene, {
        renderEnvironment: this.app.renderEnvironment,
      });

      texts.push(text);
    }

    fixBindingsAfterDeletion(
      elements,
      containers.filter((container) => container.isDeleted),
    );

    // also drops the line editor of an unwrapped arrow
    const selection = getSelectionStateForElements(
      texts,
      getNonDeletedElements(elements),
      appState,
    );
    this.unwrapped = {
      selectedElementIds: selection.selectedElementIds,
      containers: unwrapped,
    };

    return {
      elements,
      appState: { ...appState, ...selection },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  }

  /**
   * puts the unwrapped texts back into their containers, along with the
   * containers' arrows — `null` when any of them is gone
   */
  private rewrap(
    elements: readonly ExcalidrawElement[],
    appState: Readonly<AppState>,
    unwrapped: readonly UnwrappedContainer[],
  ): ActionResult | null {
    const { scene } = this.app;
    const allElementsMap = scene.getElementsMapIncludingDeleted();

    const pairs = [];
    for (const entry of unwrapped) {
      const container = allElementsMap.get(entry.containerId);
      const text = allElementsMap.get(entry.textId);
      if (
        !container?.isDeleted ||
        !isTextBindableContainer(container) ||
        !text ||
        text.isDeleted ||
        !isTextElement(text) ||
        text.containerId
      ) {
        return null;
      }
      pairs.push({ entry, deletedContainer: container, text });
    }

    for (const { deletedContainer } of pairs) {
      scene.mutateElement(deletedContainer, { isDeleted: false });
    }
    // so that the restored containers resolve as bindings again
    scene.replaceAllElements(scene.getElementsIncludingDeleted());

    const elementsMap = scene.getNonDeletedElementsMap();
    const containers: NonDeletedExcalidrawElement[] = [];

    let nextElements: readonly ExcalidrawElement[] =
      scene.getElementsIncludingDeleted();

    for (const { entry, text } of pairs) {
      const container = elementsMap.get(entry.containerId)!;
      const isArrowContainer = isArrowElement(container);
      // the container comes back wherever its text went in the meantime,
      // except an arrow anchored to the elements it connects
      const isAnchored =
        isArrowContainer && !!(container.startBinding || container.endBinding);
      const [dx, dy] = isAnchored
        ? [0, 0]
        : [text.x - entry.text.x, text.y - entry.text.y];
      const stickyInk = getStickyNoteInk(text, container);
      scene.mutateElement(container, {
        frameId: text.frameId,
        x: container.x + dx,
        y: container.y + dy,
        ...(stickyInk ? { strokeColor: stickyInk } : null),
        ...(isArrowContainer ? null : { angle: text.angle }),
      });
      // an arrow container rejoins the elements it connects
      BoundElement.rebindAffected(elementsMap, container, (element, updates) =>
        scene.mutateElement(element, updates),
      );

      const arrowIds = new Set<ExcalidrawElement["id"]>();
      for (const { id, startBinding, endBinding } of entry.arrows) {
        const arrow = elementsMap.get(id);
        if (!arrow || !isArrowElement(arrow)) {
          continue;
        }
        const isStartOnText = arrow.startBinding?.elementId === text.id;
        const isEndOnText = arrow.endBinding?.elementId === text.id;
        if (isStartOnText || isEndOnText) {
          scene.mutateElement(arrow, {
            startBinding: isStartOnText ? startBinding : arrow.startBinding,
            endBinding: isEndOnText ? endBinding : arrow.endBinding,
          });
          arrowIds.add(id);
        }
      }

      scene.mutateElement(container, {
        boundElements: [
          ...(container.boundElements ?? []),
          { id: text.id, type: "text" as const },
          ...Array.from(arrowIds, (id) => ({ id, type: "arrow" as const })),
        ],
      });
      scene.mutateElement(text, {
        containerId: container.id,
        // a note's label keeps the size picked while it was unwrapped
        baseFontSize:
          entry.baseFontSize !== null && text.fontSize !== entry.text.fontSize
            ? normalizeStickyNoteFontSize(text.fontSize)
            : entry.baseFontSize,
        labelPosition: entry.labelPosition,
        autoResize: entry.autoResize,
        ...(stickyInk ? { strokeColor: stickyInk } : null),
        // a label carries no arrows of its own
        boundElements: null,
        ...(isArrowContainer ? { angle: 0 as Radians } : null),
      });
      redrawTextBoundingBox(text, container, scene, this.app.renderEnvironment);
      updateBoundElements(container, scene, {
        renderEnvironment: this.app.renderEnvironment,
      });
      // the text may have changed layers since
      nextElements = pushContainerBelowText(nextElements, container, text);

      containers.push(container);
    }

    return {
      elements: nextElements,
      appState: {
        ...appState,
        // with the line editor of a restored arrow
        ...getSelectionStateForElements(
          containers,
          getNonDeletedElements(nextElements),
          appState,
        ),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  }
}
