import {
  doBoundsIntersect,
  getCanvasPadding,
  getCommonFrameId,
  getElementBounds,
  getFrameChildrenInsertionIndex,
  getContainerElement,
  isElementInViewport,
  isFrameLikeElement,
  isIframeLikeElement,
  isTextElement,
  shouldApplyFrameClip,
  unionBounds,
} from "@excalidraw/element";

import { arrayToMap, memoize, toBrandedType } from "@excalidraw/common";

import type { Bounds } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { DEFAULT_LINK_SIZE } from "../components/hyperlink/helpers";
import { cancelStaticSceneThrottle } from "../renderer/staticScene";

import type { RenderableElementsMap } from "./types";

import type {
  AppState,
  ElementRenderOffsets,
  StaticCanvasAppState,
} from "../types";

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

/** where an element may paint, conservatively, with offsets applied */
const getPaintBounds = (
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
  offsets: ElementRenderOffsets,
): Bounds => {
  const offset = offsets.get(element.id);
  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  // conservative: an extra moved element only costs a redraw
  const padding =
    getCanvasPadding(element) + (element.link ? DEFAULT_LINK_SIZE * 2 : 0);
  const dx = offset?.x ?? 0;
  const dy = offset?.y ?? 0;
  return [
    x1 + dx - padding,
    y1 + dy - padding,
    x2 + dx + padding,
    y2 + dy + padding,
  ];
};

/** a bound text is drawn with its container, it goes where it goes */
const getRenderTarget = (
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
) =>
  (isTextElement(element) && element.containerId
    ? elementsMap.get(element.containerId)
    : null) ?? element;

type NewElementLayersState = {
  elementsMap: RenderableElementsMap;
  offsets: ElementRenderOffsets;
  /** the elements above the new element in z-order */
  above: ReadonlySet<NonDeletedExcalidrawElement>;
  /** where the new element may paint, null if anywhere */
  newElementRegion: Bounds | null;
  /** the bounds of the moved elements, and their union for a quick reject */
  moved: Bounds[];
  movedUnion: Bounds | null;
  /** whether an element has to move to the new element canvas */
  decided: Map<NonDeletedExcalidrawElement, boolean>;
};

/**
 * Whether an element has to move to the new element canvas: it's drawn after
 * the new element and may overlap it, or it's drawn after an element that
 * moved and overlaps that. Has to be called in drawing order.
 */
const mustMoveToNewElementCanvas = (
  element: NonDeletedExcalidrawElement,
  state: NewElementLayersState,
) => {
  const decided = state.decided.get(element);
  if (decided !== undefined) {
    return decided;
  }

  const isDrawnAfterNewElement =
    state.above.has(element) || isIframeLikeElement(element);
  const bounds = getPaintBounds(element, state.elementsMap, state.offsets);
  const mustMove =
    (isDrawnAfterNewElement &&
      (!state.newElementRegion ||
        doBoundsIntersect(bounds, state.newElementRegion))) ||
    (doBoundsIntersect(bounds, state.movedUnion) &&
      state.moved.some((moved) => doBoundsIntersect(bounds, moved)));

  if (mustMove) {
    state.moved.push(bounds);
    state.movedUnion = state.movedUnion
      ? unionBounds(state.movedUnion, bounds)
      : bounds;
  }
  state.decided.set(element, mustMove);
  return mustMove;
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
    // A new text doubles as `editingTextElement` (drawn by the wysiwyg), so a
    // framed one isn't drawn on any canvas. Every other new element goes to
    // the new element canvas, framed ones included: the elements that may be
    // drawn over it are drawn there on top of it (see getNewElementLayers).
    const newElementCanvasElement =
      newElement?.frameId && isTextElement(newElement) ? null : newElement;

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
    // A new element being drag-sized is mutated in place without informing
    // the scene, so `sceneNonce` doesn't move. A new text gets its dashed text
    // box drawn by the interactive canvas (it doubles as `editingTextElement`)
    // which memoizes on this nonce, so fold the text's own nonce in.
    const canvasNonce = `${this.scene.getSceneNonce()}${
      isTextElement(newElement) ? `:${newElement.versionNonce}` : ""
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

  /**
   * Splits the static canvas' elements around a framed new element drawn on
   * the new element canvas. The new element sits at its frame's children
   * insertion index, so elements drawn after it that may overlap it have to
   * be drawn on top of it. They're moved off the static canvas to the new
   * element canvas, which draws them after the new element. Embeddables are
   * drawn on top of everything on the static canvas, so overlapping ones move
   * regardless of z-order.
   *
   * Source-over compositing is associative, so the two layers composite to
   * the same pixels as drawing everything in order on one canvas as long as
   * no static element drawn after a moved one overlaps it. Moving is
   * therefore transitive: whatever is drawn after a moved element and
   * overlaps it moves too. The static canvas then doesn't re-render while the
   * new element is being sized.
   *
   * A frame-clipped new element can only ever paint inside its frame, so
   * only elements overlapping the frame can cover it. One that isn't clipped
   * (arrows, or frame clipping disabled) can paint anywhere, so everything
   * drawn after it moves.
   */
  public getNewElementLayers = (opts: {
    /** the static canvas' visible elements (with render offsets applied) */
    visibleElements: readonly NonDeletedExcalidrawElement[];
    elementsMap: RenderableElementsMap;
    newElementCanvasElement: NonDeletedExcalidrawElement | null;
    offsets: ElementRenderOffsets;
    appState: StaticCanvasAppState;
  }) => {
    const { appState, ...rest } = opts;
    const newElement = opts.newElementCanvasElement;
    const frame = newElement?.frameId
      ? opts.elementsMap.get(newElement.frameId)
      : null;
    // mirrors the new element canvas' decision to clip it
    const isFrameClipped =
      !!newElement &&
      !!frame &&
      isFrameLikeElement(frame) &&
      appState.frameRendering.enabled &&
      shouldApplyFrameClip(newElement, frame, appState, opts.elementsMap);

    return this._getNewElementLayers({
      ...rest,
      // the new element is mutated in place, memoize on what matters
      frameId: newElement?.frameId ?? null,
      isFrameClipped,
    });
  };

  private _getNewElementLayers = memoize(
    ({
      visibleElements,
      elementsMap,
      newElementCanvasElement: newElement,
      offsets,
      frameId,
      isFrameClipped,
    }: {
      visibleElements: readonly NonDeletedExcalidrawElement[];
      elementsMap: RenderableElementsMap;
      newElementCanvasElement: NonDeletedExcalidrawElement | null;
      offsets: ElementRenderOffsets;
      frameId: string | null;
      isFrameClipped: boolean;
    }): {
      staticElements: readonly NonDeletedExcalidrawElement[];
      elementsAboveNewElement: readonly NonDeletedExcalidrawElement[];
    } => {
      const frame = frameId ? elementsMap.get(frameId) : null;

      if (!newElement || !frame || !isFrameLikeElement(frame)) {
        return { staticElements: visibleElements, elementsAboveNewElement: [] };
      }

      const elements = this.scene.getNonDeletedElements();
      const newElementIndex = elements.findIndex(
        (element) => element.id === newElement.id,
      );
      if (newElementIndex === -1) {
        return { staticElements: visibleElements, elementsAboveNewElement: [] };
      }
      const above = new Set<NonDeletedExcalidrawElement>(
        elements.slice(newElementIndex + 1),
      );

      const frameOffset = offsets.get(frame.id);
      const fx1 = frame.x + (frameOffset?.x ?? 0);
      const fy1 = frame.y + (frameOffset?.y ?? 0);

      const state: NewElementLayersState = {
        elementsMap,
        offsets,
        above,
        newElementRegion: isFrameClipped
          ? [fx1, fy1, fx1 + frame.width, fy1 + frame.height]
          : null,
        moved: [],
        movedUnion: null,
        decided: new Map(),
      };

      // decide in the static canvas' drawing order: embeddables last
      for (const isIframePass of [false, true]) {
        for (const element of visibleElements) {
          if (
            getRenderTarget(element, elementsMap) === element &&
            isIframeLikeElement(element) === isIframePass
          ) {
            mustMoveToNewElementCanvas(element, state);
          }
        }
      }

      const staticElements: NonDeletedExcalidrawElement[] = [];
      const elementsAboveNewElement: NonDeletedExcalidrawElement[] = [];

      for (const element of visibleElements) {
        // a bound text whose container isn't visible is decided here, on
        // the container
        if (
          mustMoveToNewElementCanvas(
            getRenderTarget(element, elementsMap),
            state,
          )
        ) {
          elementsAboveNewElement.push(element);
        } else {
          staticElements.push(element);
        }
      }

      return elementsAboveNewElement.length
        ? { staticElements, elementsAboveNewElement }
        : { staticElements: visibleElements, elementsAboveNewElement };
    },
  );

  // NOTE Doesn't destroy everything (scene, rc, etc.) because it may not be
  // safe to break TS contract here (for upstream cases)
  public destroy(staticCanvas: HTMLCanvasElement) {
    cancelStaticSceneThrottle(staticCanvas);
    this._getRenderableElements.clear();
    this._getVisibleElementsWithRenderOffsets.clear();
  }
}
