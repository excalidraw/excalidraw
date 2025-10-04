import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "../../types";

/**
 * Represents a 2D rectangular bounds
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a viewport for spatial queries
 */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: AppState["zoom"];
  offsetLeft: AppState["offsetLeft"];
  offsetTop: AppState["offsetTop"];
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
}

/**
 * Represents a spatial region that needs to be redrawn
 */
export interface DirtyRegion {
  bounds: Bounds;
  elements: Set<ExcalidrawElement["id"]>;
  priority: "high" | "medium" | "low";
  timestamp: number;
}

/**
 * Core interface for spatial indexing systems
 * Provides O(log n) spatial queries instead of O(n) linear search
 */
export interface SpatialIndex {
  /**
   * Insert an element into the spatial index
   */
  insert(element: NonDeletedExcalidrawElement): void;

  /**
   * Remove an element from the spatial index
   */
  remove(elementId: ExcalidrawElement["id"]): void;

  /**
   * Update an element's position in the spatial index
   */
  update(element: NonDeletedExcalidrawElement): void;

  /**
   * Query elements that intersect with the given viewport
   * Returns elements in O(log n) time instead of O(n)
   */
  query(viewport: Viewport): readonly NonDeletedExcalidrawElement[];

  /**
   * Query elements within specific bounds
   */
  queryBounds(bounds: Bounds): readonly NonDeletedExcalidrawElement[];

  /**
   * Clear all elements from the index
   */
  clear(): void;

  /**
   * Get total number of elements in the index
   */
  size(): number;

  /**
   * Rebuild the entire index (for optimization or corruption recovery)
   */
  rebuild(elements: readonly NonDeletedExcalidrawElement[]): void;
}

/**
 * Represents a node in the QuadTree spatial index
 */
export interface SpatialNode {
  bounds: Bounds;
  elements: Map<ExcalidrawElement["id"], NonDeletedExcalidrawElement>;
  children: SpatialNode[] | null;
  level: number;
  maxElements: number;
  maxDepth: number;
}

/**
 * Configuration options for QuadTree
 */
export interface QuadTreeConfig {
  maxElements: number;
  maxDepth: number;
  bounds: Bounds;
}

/**
 * Statistics for monitoring spatial index performance
 */
export interface SpatialIndexStats {
  totalElements: number;
  totalNodes: number;
  maxDepth: number;
  averageElementsPerNode: number;
  queryTime: number;
  insertTime: number;
  removeTime: number;
}

/**
 * Render operation types for the unified rendering pipeline
 */
export type RenderOperationType = "static" | "interactive" | "unified";

/**
 * Represents a render operation in the rendering queue
 */
export interface RenderOperation {
  type: RenderOperationType;
  elements: readonly NonDeletedExcalidrawElement[];
  viewport: Viewport;
  dirtyRegions?: DirtyRegion[];
  priority: number;
  timestamp: number;
  id: string;
}

/**
 * Configuration for render batching
 */
export interface RenderBatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  priorityThreshold: number;
}

/**
 * State management for the rendering system
 */
export interface RenderState {
  lastViewport: Viewport | null;
  visibleElements: Set<ExcalidrawElement["id"]>;
  dirtyRegions: Map<string, DirtyRegion>;
  frameId: number;
  isRenderScheduled: boolean;
  lastRenderTime: number;
}

/**
 * Performance metrics for monitoring rendering performance
 */
export interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
  renderTime: number;
  spatialQueryTime: number;
  elementsRendered: number;
  memoryUsage: number;
  timestamp: number;
}

/**
 * Object pool interface for reducing garbage collection pressure
 */
export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  clear(): void;
  size(): number;
  available(): number;
}

/**
 * Utility type for creating object pools
 */
export type PoolableObject = Bounds | Viewport | DirtyRegion;

/**
 * Feature flags for gradual rollout of optimizations
 */
export interface RenderingFeatureFlags {
  spatialIndexing: boolean;
  unifiedRendering: boolean;
  dirtyRegionTracking: boolean;
  objectPooling: boolean;
  performanceMonitoring: boolean;
}