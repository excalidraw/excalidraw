import {
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
  updateOriginalContainerCache,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/history";

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
  pushTextAboveContainer,
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

/** a container unwrapping freed the text of, and how the text sat in it */
type UnwrappedContainer = {
  containerId: ExcalidrawTextContainer["id"];
  textId: ExcalidrawTextElement["id"];
  /** whether the container was removed (one that wrapping made) */
  isRemoved: boolean;
  baseFontSize: ExcalidrawTextElement["baseFontSize"];
  labelPosition: ExcalidrawTextElement["labelPosition"];
  autoResize: ExcalidrawTextElement["autoResize"];
  /**
   * the freed text as it landed, to tell how far it moved since (it doesn't
   * auto-resize, so a font size change doesn't move it) and whether it was
   * resized
   */
  text: Pick<ExcalidrawTextElement, "x" | "y" | "fontSize">;
  /** the arrows bound to a removed container, as they were bound */
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
 * 2. texts, with any labeled containers: wraps each text in a new container
 * 3. labeled containers: unbinds their texts, keeping both selected
 * 4. a frame with any of its children, or all of a frame's children: removes
 *    the frame
 * 5. anything else without a frame: wraps it in a frame
 *
 * While the selection it left stands, the next toggle takes (2) and (3) back:
 * the new containers (2) are removed rather than kept, and the unwrapped texts
 * (3) go back into their containers as they sat in them, bringing the removed
 * containers back.
 */
export class AppWrap {
  /** what the last toggle did, to take back while its selection stands */
  private last: {
    selectedElementIds: AppState["selectedElementIds"];
    /** the containers it wrapped texts in (or brought back) */
    created?: ReadonlySet<ExcalidrawElement["id"]>;
    /** the containers it unwrapped */
    unwrapped?: readonly UnwrappedContainer[];
  } | null = null;

  constructor(private app: App) {}

  toggle = (
    elements: readonly ExcalidrawElement[],
    appState: Readonly<AppState>,
  ): ActionResult => {
    const last =
      this.last?.selectedElementIds === appState.selectedElementIds
        ? this.last
        : null;
    this.last = null;

    if (last?.unwrapped) {
      const rewrapped = this.rewrap(elements, appState, last.unwrapped);
      if (rewrapped) {
        return rewrapped;
      }
    }

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
      const result = wrapTextsInContainers(elements, appState, texts, this.app);
      if (!result) {
        return result;
      }
      const created = Object.keys(result.appState?.selectedElementIds ?? {});
      // the labeled containers stay selected, to unwrap next along with the
      // new ones
      const selectedElementIds = Object.fromEntries(
        [...created, ...labeledContainers.map((element) => element.id)].map(
          (id) => [id, true] as const,
        ),
      );
      this.last = { selectedElementIds, created: new Set(created) };

      return {
        ...result,
        appState: { ...result.appState, selectedElementIds },
      };
    }

    if (labeledContainers.length === selectedElements.length) {
      return this.unwrap(elements, appState, labeledContainers, last?.created);
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

  /**
   * frees the containers' texts, keeping the containers selected along with
   * them — except the `created` ones, removed with their arrows moved onto the
   * texts
   */
  private unwrap(
    elements: readonly ExcalidrawElement[],
    appState: Readonly<AppState>,
    containers: readonly NonDeletedExcalidrawElement[],
    created: ReadonlySet<ExcalidrawElement["id"]> | undefined,
  ): ActionResult {
    const { scene } = this.app;
    const elementsMap = scene.getNonDeletedElementsMap();
    const freed: NonDeletedExcalidrawElement[] = [];
    const removed: ExcalidrawElement[] = [];
    const unwrapped: UnwrappedContainer[] = [];

    for (const container of containers) {
      const text = getBoundTextElement(container, elementsMap);
      if (!text) {
        continue;
      }
      const isRemoved = !!created?.has(container.id);
      const arrows = isRemoved
        ? (container.boundElements ?? []).flatMap(({ id }) => {
            const arrow = elementsMap.get(id);
            return arrow && isArrowElement(arrow) ? [arrow] : [];
          })
        : [];

      const { baseFontSize, labelPosition, autoResize } = text;
      unbindTextFromContainer(container, text, this.app);
      unwrapped.push({
        containerId: container.id,
        textId: text.id,
        isRemoved,
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

      if (isRemoved) {
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
        scene.mutateElement(container as ExcalidrawElement, {
          isDeleted: true,
          boundElements: container.boundElements?.filter(
            ({ id }) => !arrows.some((arrow) => arrow.id === id),
          ),
        });
        updateBoundElements(text, scene, {
          renderEnvironment: this.app.renderEnvironment,
        });
        removed.push(container);
      } else {
        freed.push(container);
      }

      freed.push(text);
    }

    fixBindingsAfterDeletion(elements, removed);

    // also drops the line editor of an unwrapped arrow
    const selection = getSelectionStateForElements(
      freed,
      getNonDeletedElements(elements),
      appState,
    );
    this.last = {
      selectedElementIds: selection.selectedElementIds,
      unwrapped,
    };

    return {
      elements,
      appState: { ...appState, ...selection },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  }

  /**
   * puts the unwrapped texts back into their containers as they sat in them,
   * bringing back the removed containers along with their arrows — `null`
   * when any of them is gone
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
        !container ||
        container.isDeleted !== entry.isRemoved ||
        !isTextBindableContainer(container) ||
        hasBoundTextElement(container) ||
        !text ||
        text.isDeleted ||
        !isTextElement(text) ||
        text.containerId
      ) {
        return null;
      }
      pairs.push({ entry, container, text });
    }

    for (const { entry, container } of pairs) {
      if (entry.isRemoved) {
        scene.mutateElement(container, { isDeleted: false });
      }
    }
    // so that the restored containers resolve as bindings again
    scene.replaceAllElements(scene.getElementsIncludingDeleted());

    const elementsMap = scene.getNonDeletedElementsMap();
    const containers: NonDeletedExcalidrawElement[] = [];

    let nextElements: readonly ExcalidrawElement[] =
      scene.getElementsIncludingDeleted();

    for (const { entry, text } of pairs) {
      const container = elementsMap.get(entry.containerId)!;
      const arrowIds = new Set<ExcalidrawElement["id"]>();

      if (entry.isRemoved) {
        // the container comes back wherever its text went in the meantime
        scene.mutateElement(container, {
          frameId: text.frameId,
          x: container.x + text.x - entry.text.x,
          y: container.y + text.y - entry.text.y,
          angle: text.angle,
        });

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
      }

      const stickyInk = getStickyNoteInk(text, container);
      scene.mutateElement(container, {
        boundElements: [
          ...(container.boundElements ?? []),
          { id: text.id, type: "text" as const },
          ...Array.from(arrowIds, (id) => ({ id, type: "arrow" as const })),
        ],
        ...(stickyInk ? { strokeColor: stickyInk } : null),
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
        angle: (isArrowElement(container) ? 0 : container.angle) as Radians,
      });
      // the height to go back to when unbound
      const originalContainerHeight = container.height;
      redrawTextBoundingBox(text, container, scene, this.app.renderEnvironment);
      updateOriginalContainerCache(container.id, originalContainerHeight);
      updateBoundElements(container, scene, {
        renderEnvironment: this.app.renderEnvironment,
      });
      // a removed container joins its text, which may have changed layers
      nextElements = entry.isRemoved
        ? pushContainerBelowText(nextElements, container, text)
        : pushTextAboveContainer(nextElements, container, text);

      containers.push(container);
    }

    const selection = getSelectionStateForElements(
      containers,
      getNonDeletedElements(nextElements),
      appState,
    );
    this.last = {
      selectedElementIds: selection.selectedElementIds,
      // removed again by the next toggle
      created: new Set(
        unwrapped
          .filter((entry) => entry.isRemoved)
          .map((entry) => entry.containerId),
      ),
    };

    return {
      elements: nextElements,
      // with the line editor of an arrow
      appState: { ...appState, ...selection },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  }
}
