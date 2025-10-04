import { isElementInViewport } from "@excalidraw/element";

import { memoize, toBrandedType } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  NonDeletedElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { renderInteractiveSceneThrottled } from "../renderer/interactiveScene";
import { renderStaticSceneThrottled } from "../renderer/staticScene";

import type { RenderableElementsMap } from "./types";
import { QuadTree } from "./spatial/QuadTree";
import type { SpatialIndex, Viewport, RenderingFeatureFlags } from "./spatial/types";

import type { AppState } from "../types";

export class Renderer {
  private scene: Scene;
  private spatialIndex: SpatialIndex | null = null;
  private featureFlags: RenderingFeatureFlags;
  private lastElementsVersion: number = -1;

  constructor(scene: Scene, featureFlags?: Partial<RenderingFeatureFlags>) {
    this.scene = scene;
    this.featureFlags = {
      spatialIndexing: true,
      unifiedRendering: false,
      dirtyRegionTracking: false,
      objectPooling: false,
      performanceMonitoring: false,
      ...featureFlags,
    };

    // Initialize spatial index if enabled
    if (this.featureFlags.spatialIndexing) {
      this.initializeSpatialIndex();
    }
  }

  private initializeSpatialIndex(): void {
    try {
      // Create a large initial bounds for the spatial index
      // This will be dynamically adjusted as elements are added
      const initialBounds = {
        x: -50000,
        y: -50000,
        width: 100000,
        height: 100000,
      };

      this.spatialIndex = new QuadTree(
        {
          maxElements: 10,
          maxDepth: 8,
          bounds: initialBounds,
        },
        this.scene.getNonDeletedElementsMap() as unknown as NonDeletedElementsMap
      );

      // Populate with existing elements
      this.rebuildSpatialIndex();
    } catch (error) {
      console.warn("Failed to initialize spatial index, falling back to linear search:", error);
      this.spatialIndex = null;
      this.featureFlags.spatialIndexing = false;
    }
  }

  private rebuildSpatialIndex(): void {
    if (!this.spatialIndex) return;

    try {
      const elements = this.scene.getNonDeletedElements();
      this.spatialIndex.rebuild(elements);
      this.lastElementsVersion = this.scene.getSceneNonce() ?? 0;
    } catch (error) {
      console.warn("Failed to rebuild spatial index:", error);
      this.spatialIndex = null;
      this.featureFlags.spatialIndexing = false;
    }
  }

  private updateSpatialIndex(): void {
    if (!this.spatialIndex) return;

    const currentVersion = this.scene.getSceneNonce() ?? 0;
    if (currentVersion !== this.lastElementsVersion) {
      // For now, we rebuild the entire index when elements change
      // TODO: Implement incremental updates for better performance
      this.rebuildSpatialIndex();
    }
  }

  public getRenderableElements = (() => {
    const getVisibleCanvasElements = ({
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
    }): readonly NonDeletedExcalidrawElement[] => {
      // Update spatial index if needed
      this.updateSpatialIndex();

      // Use spatial indexing if available and enabled
      if (this.featureFlags.spatialIndexing && this.spatialIndex) {
        try {
          const viewport: Viewport = {
            x: 0, // Will be calculated in viewportToBounds
            y: 0,
            width,
            height,
            zoom,
            offsetLeft,
            offsetTop,
            scrollX,
            scrollY,
          };

          const spatialResults = this.spatialIndex.query(viewport);

          // Filter results to only include elements that are in the elementsMap
          // This ensures we respect the same filtering logic as the original implementation
          const visibleElements: NonDeletedExcalidrawElement[] = [];
          for (const element of spatialResults) {
            if (elementsMap.has(element.id)) {
              visibleElements.push(element);
            }
          }

          return visibleElements;
        } catch (error) {
          console.warn("Spatial index query failed, falling back to linear search:", error);
          // Fall through to linear search
        }
      }

      // Fallback to original O(n) linear search
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
    };

    const getRenderableElements = ({
      elements,
      editingTextElement,
      newElementId,
    }: {
      elements: readonly NonDeletedExcalidrawElement[];
      editingTextElement: AppState["editingTextElement"];
      newElementId: ExcalidrawElement["id"] | undefined;
    }) => {
      const elementsMap = toBrandedType<RenderableElementsMap>(new Map());

      for (const element of elements) {
        if (newElementId === element.id) {
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
      return elementsMap;
    };

    return memoize(
      ({
        zoom,
        offsetLeft,
        offsetTop,
        scrollX,
        scrollY,
        height,
        width,
        editingTextElement,
        newElementId,
        // cache-invalidation nonce
        sceneNonce: _sceneNonce,
      }: {
        zoom: AppState["zoom"];
        offsetLeft: AppState["offsetLeft"];
        offsetTop: AppState["offsetTop"];
        scrollX: AppState["scrollX"];
        scrollY: AppState["scrollY"];
        height: AppState["height"];
        width: AppState["width"];
        editingTextElement: AppState["editingTextElement"];
        /** note: first render of newElement will always bust the cache
         * (we'd have to prefilter elements outside of this function) */
        newElementId: ExcalidrawElement["id"] | undefined;
        sceneNonce: ReturnType<InstanceType<typeof Scene>["getSceneNonce"]>;
      }) => {
        const elements = this.scene.getNonDeletedElements();

        const elementsMap = getRenderableElements({
          elements,
          editingTextElement,
          newElementId,
        });

        const visibleElements = getVisibleCanvasElements({
          elementsMap,
          zoom,
          offsetLeft,
          offsetTop,
          scrollX,
          scrollY,
          height,
          width,
        });

        return { elementsMap, visibleElements };
      },
    );
  })();

  // NOTE Doesn't destroy everything (scene, rc, etc.) because it may not be
  // safe to break TS contract here (for upstream cases)
  public destroy() {
    renderInteractiveSceneThrottled.cancel();
    renderStaticSceneThrottled.cancel();
    this.getRenderableElements.clear();

    // Clean up spatial index
    if (this.spatialIndex) {
      this.spatialIndex.clear();
      this.spatialIndex = null;
    }
  }

  // Public method to get spatial index statistics for performance monitoring
  public getSpatialIndexStats() {
    if (this.spatialIndex && 'getStats' in this.spatialIndex) {
      return (this.spatialIndex as QuadTree).getStats();
    }
    return null;
  }

  // Public method to toggle spatial indexing feature
  public setSpatialIndexing(enabled: boolean) {
    if (enabled && !this.spatialIndex) {
      this.featureFlags.spatialIndexing = true;
      this.initializeSpatialIndex();
    } else if (!enabled && this.spatialIndex) {
      this.featureFlags.spatialIndexing = false;
      this.spatialIndex.clear();
      this.spatialIndex = null;
    }
  }
}
