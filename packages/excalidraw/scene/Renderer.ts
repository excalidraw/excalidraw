import {
  getCommonFrameId,
  getFrameChildrenInsertionIndex,
  getContainerElement,
  isElementInViewport,
  isTextElement,
} from "@excalidraw/element";

import { arrayToMap, memoize, toBrandedType } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { renderStaticSceneThrottled } from "../renderer/staticScene";

import type { RenderableElementsMap } from "./types";

import type { AppState, ElementRenderOffsets } from "../types";

type GetRenderableElementsOpts = {
  zoom: AppState["zoom"];
  offsetLeft: AppState["offsetLeft"];
  offsetTop: AppState["offsetTop"];
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  height: AppState["height"];
  width: AppState["width"];
  editingTextElement: AppState["editingTextElement"];
  newElement: AppState["newElement"];
  selectedElements: readonly NonDeletedExcalidrawElement[];
  selectedElementsAreBeingDragged: AppState["selectedElementsAreBeingDragged"];
  frameToHighlight: AppState["frameToHighlight"];
};

export class Renderer {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Adjusts the document-visible set for render-override translations: an
   * element leaves it when its offset moves it out of view and enters it when
   * its offset brings it in; everything else keeps its document visibility.
   * Only translated elements go through viewport geometry. The result is
   * memoized on the offsets' identity so that opacity-only snapshots don't
   * reach it at all.
   */
  public getVisibleElementsWithRenderOffsets(
    visibleElements: readonly NonDeletedExcalidrawElement[],
    elementsMap: RenderableElementsMap,
    appState: AppState,
    offsets: ElementRenderOffsets,
  ) {
    return this._getVisibleElementsWithRenderOffsets({
      visibleElements,
      elementsMap,
      offsets,
      zoom: appState.zoom,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      offsetLeft: appState.offsetLeft,
      offsetTop: appState.offsetTop,
      width: appState.width,
      height: appState.height,
      selectedElements: this.scene.getSelectedElements(appState),
      frameToHighlight: appState.selectedElementsAreBeingDragged
        ? appState.frameToHighlight
        : null,
    });
  }

  private _getVisibleElementsWithRenderOffsets = memoize(
    ({
      visibleElements,
      elementsMap,
      offsets,
      selectedElements,
      frameToHighlight,
      ...viewport
    }: Pick<
      GetRenderableElementsOpts,
      | "zoom"
      | "scrollX"
      | "scrollY"
      | "offsetLeft"
      | "offsetTop"
      | "width"
      | "height"
      | "selectedElements"
      | "frameToHighlight"
    > & {
      visibleElements: readonly NonDeletedExcalidrawElement[];
      elementsMap: RenderableElementsMap;
      offsets: ElementRenderOffsets;
    }) => {
      // Shifting the viewport instead of the element also works for arrow
      // labels, whose coordinates derive from their container.
      const isVisible = (
        element: NonDeletedExcalidrawElement,
        offset: ElementRenderOffsets extends ReadonlyMap<string, infer T>
          ? T
          : never,
      ) =>
        isElementInViewport(
          element,
          viewport.width,
          viewport.height,
          {
            ...viewport,
            scrollX: viewport.scrollX + offset.x,
            scrollY: viewport.scrollY + offset.y,
          },
          elementsMap,
        );

      const documentVisible = this.getVisibleSet(visibleElements);
      const added = new Set<NonDeletedExcalidrawElement>();
      const removed = new Set<NonDeletedExcalidrawElement>();
      const update = (
        element: NonDeletedExcalidrawElement,
        visible: boolean,
      ) => {
        if (documentVisible.has(element) !== visible) {
          (visible ? added : removed).add(element);
        }
      };
      for (const [id, offset] of offsets) {
        const element = elementsMap.get(id);
        // A bound label's own offset is ignored, and it needs no entry of
        // its own: the static renderer draws it with its container and skips
        // its entry, so its document visibility can stay as it is.
        if (
          !element ||
          (isTextElement(element) && getContainerElement(element, elementsMap))
        ) {
          continue;
        }
        update(element, isVisible(element, offset));
      }

      if (!added.size && !removed.size) {
        return visibleElements;
      }

      const needsFrameReordering =
        frameToHighlight &&
        getCommonFrameId(selectedElements) !== frameToHighlight.id;
      if (!added.size && !needsFrameReordering) {
        return visibleElements.filter((element) => !removed.has(element));
      }

      // Rebuild in scene order when elements enter the view. Frame-drag
      // ordering also needs rebuilding on removals, since the anchoring frame
      // may have left the view.
      const result: NonDeletedExcalidrawElement[] = [];
      for (const element of elementsMap.values()) {
        if (
          added.has(element) ||
          (documentVisible.has(element) && !removed.has(element))
        ) {
          result.push(element);
        }
      }
      return needsFrameReordering
        ? this.sortSelectedElementsIntoHighlightedFrame({
            visibleElements: result,
            selectedElements,
            frameToHighlight,
          })
        : result;
    },
  );

  /** the document-visible elements as a set, cached per visible array */
  private visibleSets = new WeakMap<
    readonly NonDeletedExcalidrawElement[],
    Set<NonDeletedExcalidrawElement>
  >();

  private getVisibleSet(
    visibleElements: readonly NonDeletedExcalidrawElement[],
  ) {
    let set = this.visibleSets.get(visibleElements);
    if (!set) {
      set = new Set(visibleElements);
      this.visibleSets.set(visibleElements, set);
    }
    return set;
  }

  private getVisibleCanvasElements({
    elementsMap,
    zoom,
    offsetLeft,
    offsetTop,
    scrollX,
    scrollY,
    height,
    width,
  }: {
    elementsMap: NonDeletedElementsMap;
    zoom: AppState["zoom"];
    offsetLeft: AppState["offsetLeft"];
    offsetTop: AppState["offsetTop"];
    scrollX: AppState["scrollX"];
    scrollY: AppState["scrollY"];
    height: AppState["height"];
    width: AppState["width"];
  }): readonly NonDeletedExcalidrawElement[] {
    const visibleElements: NonDeletedExcalidrawElement[] = [];
    for (const element of elementsMap.values()) {
      if (
        isElementInViewport(
          element,
          width,
          height,
          {
            zoom,
            offsetLeft,
            offsetTop,
            scrollX,
            scrollY,
          },
          elementsMap,
        )
      ) {
        visibleElements.push(element);
      }
    }
    return visibleElements;
  }

  private getRenderableElementsMap({
    elements,
    editingTextElement,
    newElement,
  }: {
    elements: readonly NonDeletedExcalidrawElement[];
    editingTextElement: AppState["editingTextElement"];
    newElement: AppState["newElement"];
  }) {
    const elementsMap = toBrandedType<RenderableElementsMap>(new Map());
    const newElementCanvasElement = newElement?.frameId ? null : newElement;

    for (const element of elements) {
      if (newElementCanvasElement?.id === element.id) {
        continue;
      }

      // we don't want to render text element that's being currently edited
      // (it's rendered on remote only)
      if (
        !editingTextElement ||
        editingTextElement.type !== "text" ||
        element.id !== editingTextElement.id
      ) {
        elementsMap.set(element.id, element);
      }
    }
    return { elementsMap, newElementCanvasElement };
  }

  private sortSelectedElementsIntoHighlightedFrame<
    T extends ExcalidrawElement,
  >({
    visibleElements,
    selectedElements,
    frameToHighlight,
  }: {
    selectedElements: readonly NonDeletedExcalidrawElement[];
    visibleElements: readonly T[];
    frameToHighlight: NonDeleted<ExcalidrawFrameLikeElement>;
  }): readonly T[] {
    if (!selectedElements.length) {
      return visibleElements;
    }

    // we assume all selected elements are eligible frame children if
    // frameToHighlight is defined
    const selectedElementsMap = arrayToMap(selectedElements);

    // thus, all deselected elements are the ones we won't reorder
    const deselectedElements = visibleElements.filter(
      (element) => !selectedElementsMap.has(element.id),
    );

    const insertionIndex = getFrameChildrenInsertionIndex(
      deselectedElements,
      frameToHighlight.id,
    );

    if (insertionIndex === null) {
      return visibleElements;
    }

    return [
      ...deselectedElements.slice(0, insertionIndex),
      ...selectedElements,
      ...deselectedElements.slice(insertionIndex),
    ] as readonly T[];
  }

  private _getRenderableElements = memoize(
    ({
      canvasNonce,
      zoom,
      offsetLeft,
      offsetTop,
      scrollX,
      scrollY,
      height,
      width,
      editingTextElement,
      newElement,
    }: Omit<
      GetRenderableElementsOpts,
      | "selectedElements"
      | "selectedElementsAreBeingDragged"
      | "frameToHighlight"
    > & {
      canvasNonce: string;
    }) => {
      const elements = this.scene.getNonDeletedElements();

      const { elementsMap, newElementCanvasElement } =
        this.getRenderableElementsMap({
          elements,
          editingTextElement,
          newElement,
        });

      const visibleElements = this.getVisibleCanvasElements({
        elementsMap,
        zoom,
        offsetLeft,
        offsetTop,
        scrollX,
        scrollY,
        height,
        width,
      });

      return {
        elementsMap,
        visibleElements,
        newElementCanvasElement,
        canvasNonce,
      };
    },
  );

  public getRenderableElements = (opts: GetRenderableElementsOpts) => {
    const { newElement } = opts;
    const canvasNonce = `${this.scene.getSceneNonce()}${
      newElement?.frameId ? `:${newElement.versionNonce}` : ""
    }`;

    const ret = this._getRenderableElements({
      canvasNonce,

      // don't spread `opts` because we don't want to memoize on some props

      zoom: opts.zoom,
      offsetLeft: opts.offsetLeft,
      offsetTop: opts.offsetTop,
      scrollX: opts.scrollX,
      scrollY: opts.scrollY,
      height: opts.height,
      width: opts.width,
      editingTextElement: opts.editingTextElement,
      newElement: opts.newElement,
    });

    // if we're dragging elements over a frame, reorder the selected elements
    // inside the frame during render (we don't set the `element.frameId` until
    // pointerup else we'd have to painstainly restore the orig index if user
    // didn't end up adding elements to the frame)
    if (
      opts.frameToHighlight &&
      opts.selectedElementsAreBeingDragged &&
      // if all dragged elements are already in the frame, don't reorder
      getCommonFrameId(opts.selectedElements) !== opts.frameToHighlight.id
    ) {
      const reorderedVisibleElements =
        this.sortSelectedElementsIntoHighlightedFrame({
          visibleElements: ret.visibleElements,
          selectedElements: opts.selectedElements,
          frameToHighlight: opts.frameToHighlight,
        });

      return {
        ...ret,
        visibleElements: reorderedVisibleElements,
      };
    }

    return ret;
  };

  // NOTE Doesn't destroy everything (scene, rc, etc.) because it may not be
  // safe to break TS contract here (for upstream cases)
  public destroy() {
    renderStaticSceneThrottled.cancel();
    this._getRenderableElements.clear();
    this._getVisibleElementsWithRenderOffsets.clear();
  }
}
