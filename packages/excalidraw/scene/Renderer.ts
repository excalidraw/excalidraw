import {
  getCommonFrameId,
  getElementBounds,
  getFrameChildrenInsertionIndex,
  isElementInViewport,
} from "@excalidraw/element";

import {
  arrayToMap,
  memoize,
  toBrandedType,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

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

import type { AppState } from "../types";

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

// size (in scene coordinates) of a single uniform-grid cell used to index
// elements for viewport culling. Scene-space (zoom-independent) so the index
// survives pan/zoom without rebuilding.
const GRID_CELL_SIZE = 1000;

export class Renderer {
  private scene: Scene;

  // uniform spatial grid used to avoid an O(N) scan over every element on each
  // viewport update. Cached and only rebuilt when the underlying set of
  // renderable elements changes (tracked via `key`), not on pan/zoom.
  private gridCache: {
    key: string;
    grid: Map<string, Set<string>>;
    order: Map<string, number>;
  } | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // builds (or returns a cached) uniform spatial grid indexing every element by
  // the grid cells its bounding box overlaps. `order` records each element's
  // index in the original (z-ordered) iteration so we can restore stacking
  // order after a grid query. Rebuilds are O(N) but only happen when `key`
  // changes (i.e. the scene/renderable set changed), so pan/zoom reuses it.
  private getSpatialGrid(elementsMap: NonDeletedElementsMap, key: string) {
    if (this.gridCache && this.gridCache.key === key) {
      return this.gridCache;
    }

    const grid = new Map<string, Set<string>>();
    const order = new Map<string, number>();

    let index = 0;
    for (const element of elementsMap.values()) {
      order.set(element.id, index++);

      const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
      const minCol = Math.floor(x1 / GRID_CELL_SIZE);
      const maxCol = Math.floor(x2 / GRID_CELL_SIZE);
      const minRow = Math.floor(y1 / GRID_CELL_SIZE);
      const maxRow = Math.floor(y2 / GRID_CELL_SIZE);

      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          const cellKey = `${col}:${row}`;
          let bucket = grid.get(cellKey);
          if (!bucket) {
            bucket = new Set();
            grid.set(cellKey, bucket);
          }
          bucket.add(element.id);
        }
      }
    }

    this.gridCache = { key, grid, order };
    return this.gridCache;
  }

  private getVisibleCanvasElements({
    elementsMap,
    gridCacheKey,
    zoom,
    offsetLeft,
    offsetTop,
    scrollX,
    scrollY,
    height,
    width,
  }: {
    elementsMap: NonDeletedElementsMap;
    gridCacheKey: string;
    zoom: AppState["zoom"];
    offsetLeft: AppState["offsetLeft"];
    offsetTop: AppState["offsetTop"];
    scrollX: AppState["scrollX"];
    scrollY: AppState["scrollY"];
    height: AppState["height"];
    width: AppState["width"];
  }): readonly NonDeletedExcalidrawElement[] {
    const { grid, order } = this.getSpatialGrid(elementsMap, gridCacheKey);

    const viewTransformations = {
      zoom,
      offsetLeft,
      offsetTop,
      scrollX,
      scrollY,
    };

    // viewport rect in scene coordinates — computed once per frame instead of
    // (previously) once per element.
    const topLeft = viewportCoordsToSceneCoords(
      { clientX: offsetLeft, clientY: offsetTop },
      viewTransformations,
    );
    const bottomRight = viewportCoordsToSceneCoords(
      { clientX: offsetLeft + width, clientY: offsetTop + height },
      viewTransformations,
    );

    // collect candidate ids from the grid cells the viewport overlaps. Because
    // elements are bucketed by the same bounds `isElementInViewport` tests,
    // every truly-visible element is guaranteed to be among the candidates (no
    // false negatives); the precise check below removes false positives.
    const candidateIds = new Set<string>();
    const minCol = Math.floor(topLeft.x / GRID_CELL_SIZE);
    const maxCol = Math.floor(bottomRight.x / GRID_CELL_SIZE);
    const minRow = Math.floor(topLeft.y / GRID_CELL_SIZE);
    const maxRow = Math.floor(bottomRight.y / GRID_CELL_SIZE);

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const bucket = grid.get(`${col}:${row}`);
        if (bucket) {
          for (const id of bucket) {
            candidateIds.add(id);
          }
        }
      }
    }

    // run the authoritative viewport check only on candidates
    const visibleElements: NonDeletedExcalidrawElement[] = [];
    for (const id of candidateIds) {
      const element = elementsMap.get(id);
      if (
        element &&
        isElementInViewport(
          element,
          width,
          height,
          viewTransformations,
          elementsMap,
        )
      ) {
        visibleElements.push(element);
      }
    }

    // CRITICAL: restore original z-order (a grid query yields no inherent
    // ordering, but render order must follow the scene element order).
    visibleElements.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );

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

      // the renderable set is determined by the scene contents plus which
      // element (if any) is being edited / freshly drawn (those are filtered
      // out above). Keying the spatial grid on these lets pan/zoom reuse it
      // while still rebuilding when the set actually changes.
      const gridCacheKey = `${this.scene.getSceneNonce()}:${
        editingTextElement?.id ?? ""
      }:${newElement?.id ?? ""}`;

      const visibleElements = this.getVisibleCanvasElements({
        elementsMap,
        gridCacheKey,
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
    this.gridCache = null;
  }
}
