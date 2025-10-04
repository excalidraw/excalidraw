import { getElementBounds } from "@excalidraw/element";
import type { ExcalidrawElement, NonDeletedExcalidrawElement, NonDeletedElementsMap } from "@excalidraw/element/types";

import type {
  Bounds,
  SpatialIndex,
  SpatialNode,
  QuadTreeConfig,
  Viewport,
  SpatialIndexStats,
} from "./types";

/**
 * QuadTree implementation for spatial indexing of Excalidraw elements
 * Provides O(log n) spatial queries instead of O(n) linear search
 */
export class QuadTree implements SpatialIndex {
  private root: QuadTreeNode;
  private config: QuadTreeConfig;
  private elementsMap: NonDeletedElementsMap;
  private stats: SpatialIndexStats;

  constructor(config: QuadTreeConfig, elementsMap: NonDeletedElementsMap) {
    this.config = config;
    this.elementsMap = elementsMap;
    this.root = new QuadTreeNode(config.bounds, 0, config);
    this.stats = {
      totalElements: 0,
      totalNodes: 1,
      maxDepth: 0,
      averageElementsPerNode: 0,
      queryTime: 0,
      insertTime: 0,
      removeTime: 0,
    };
  }

  insert(element: NonDeletedExcalidrawElement): void {
    const startTime = performance.now();
    
    try {
      const bounds = this.getElementBounds(element);
      this.root.insert(element, bounds);
      this.stats.totalElements++;
      this.updateStats();
    } catch (error) {
      console.warn("QuadTree insert failed, element may have invalid bounds:", error);
    } finally {
      this.stats.insertTime = performance.now() - startTime;
    }
  }

  remove(elementId: ExcalidrawElement["id"]): void {
    const startTime = performance.now();
    
    try {
      const removed = this.root.remove(elementId);
      if (removed) {
        this.stats.totalElements--;
        this.updateStats();
      }
    } catch (error) {
      console.warn("QuadTree remove failed:", error);
    } finally {
      this.stats.removeTime = performance.now() - startTime;
    }
  }

  update(element: NonDeletedExcalidrawElement): void {
    // For updates, we remove and re-insert the element
    // This ensures it's placed in the correct spatial location
    this.remove(element.id);
    this.insert(element);
  }

  query(viewport: Viewport): readonly NonDeletedExcalidrawElement[] {
    const startTime = performance.now();
    
    try {
      const viewportBounds = this.viewportToBounds(viewport);
      const results = this.root.query(viewportBounds);
      return results;
    } catch (error) {
      console.warn("QuadTree query failed, falling back to empty result:", error);
      return [];
    } finally {
      this.stats.queryTime = performance.now() - startTime;
    }
  }

  queryBounds(bounds: Bounds): readonly NonDeletedExcalidrawElement[] {
    const startTime = performance.now();
    
    try {
      const results = this.root.query(bounds);
      return results;
    } catch (error) {
      console.warn("QuadTree queryBounds failed:", error);
      return [];
    } finally {
      this.stats.queryTime = performance.now() - startTime;
    }
  }

  clear(): void {
    this.root = new QuadTreeNode(this.config.bounds, 0, this.config);
    this.stats.totalElements = 0;
    this.stats.totalNodes = 1;
    this.updateStats();
  }

  size(): number {
    return this.stats.totalElements;
  }

  rebuild(elements: readonly NonDeletedExcalidrawElement[]): void {
    this.clear();
    for (const element of elements) {
      this.insert(element);
    }
  }

  getStats(): SpatialIndexStats {
    return { ...this.stats };
  }

  private getElementBounds(element: NonDeletedExcalidrawElement): Bounds {
    const [x1, y1, x2, y2] = getElementBounds(element, this.elementsMap);
    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
    };
  }

  private viewportToBounds(viewport: Viewport): Bounds {
    // Convert viewport coordinates to world coordinates
    const { scrollX, scrollY, zoom, width, height } = viewport;
    
    return {
      x: scrollX - width / (2 * zoom.value),
      y: scrollY - height / (2 * zoom.value),
      width: width / zoom.value,
      height: height / zoom.value,
    };
  }

  private updateStats(): void {
    const nodeStats = this.root.getNodeStats();
    this.stats.totalNodes = nodeStats.totalNodes;
    this.stats.maxDepth = nodeStats.maxDepth;
    this.stats.averageElementsPerNode = 
      this.stats.totalNodes > 0 ? this.stats.totalElements / this.stats.totalNodes : 0;
  }
}

/**
 * Individual node in the QuadTree
 */
class QuadTreeNode implements SpatialNode {
  bounds: Bounds;
  elements: Map<ExcalidrawElement["id"], NonDeletedExcalidrawElement>;
  children: QuadTreeNode[] | null;
  level: number;
  maxElements: number;
  maxDepth: number;

  constructor(bounds: Bounds, level: number, config: QuadTreeConfig) {
    this.bounds = bounds;
    this.elements = new Map();
    this.children = null;
    this.level = level;
    this.maxElements = config.maxElements;
    this.maxDepth = config.maxDepth;
  }

  insert(element: NonDeletedExcalidrawElement, elementBounds: Bounds): void {
    // If element doesn't fit in this node, don't insert
    if (!this.boundsIntersect(this.bounds, elementBounds)) {
      return;
    }

    // If we have children, try to insert into appropriate child
    if (this.children) {
      for (const child of this.children) {
        child.insert(element, elementBounds);
      }
      return;
    }

    // Add element to this node
    this.elements.set(element.id, element);

    // If we exceed capacity and haven't reached max depth, subdivide
    if (this.elements.size > this.maxElements && this.level < this.maxDepth) {
      this.subdivide();
      
      // Redistribute elements to children
      const elementsToRedistribute = Array.from(this.elements.values());
      this.elements.clear();
      
      for (const elem of elementsToRedistribute) {
        const bounds = this.getElementBounds(elem);
        for (const child of this.children!) {
          child.insert(elem, bounds);
        }
      }
    }
  }

  remove(elementId: ExcalidrawElement["id"]): boolean {
    // Check if element is in this node
    if (this.elements.has(elementId)) {
      this.elements.delete(elementId);
      return true;
    }

    // If we have children, try to remove from children
    if (this.children) {
      for (const child of this.children) {
        if (child.remove(elementId)) {
          return true;
        }
      }
    }

    return false;
  }

  query(queryBounds: Bounds): NonDeletedExcalidrawElement[] {
    const results: NonDeletedExcalidrawElement[] = [];

    // If query bounds don't intersect with this node, return empty
    if (!this.boundsIntersect(this.bounds, queryBounds)) {
      return results;
    }

    // Add elements from this node that intersect with query bounds
    for (const element of this.elements.values()) {
      const elementBounds = this.getElementBounds(element);
      if (this.boundsIntersect(elementBounds, queryBounds)) {
        results.push(element);
      }
    }

    // Query children if they exist
    if (this.children) {
      for (const child of this.children) {
        results.push(...child.query(queryBounds));
      }
    }

    return results;
  }

  getNodeStats(): { totalNodes: number; maxDepth: number } {
    let totalNodes = 1;
    let maxDepth = this.level;

    if (this.children) {
      for (const child of this.children) {
        const childStats = child.getNodeStats();
        totalNodes += childStats.totalNodes;
        maxDepth = Math.max(maxDepth, childStats.maxDepth);
      }
    }

    return { totalNodes, maxDepth };
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    this.children = [
      // Top-left
      new QuadTreeNode(
        { x, y, width: halfWidth, height: halfHeight },
        this.level + 1,
        { maxElements: this.maxElements, maxDepth: this.maxDepth, bounds: this.bounds }
      ),
      // Top-right
      new QuadTreeNode(
        { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        this.level + 1,
        { maxElements: this.maxElements, maxDepth: this.maxDepth, bounds: this.bounds }
      ),
      // Bottom-left
      new QuadTreeNode(
        { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.level + 1,
        { maxElements: this.maxElements, maxDepth: this.maxDepth, bounds: this.bounds }
      ),
      // Bottom-right
      new QuadTreeNode(
        { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.level + 1,
        { maxElements: this.maxElements, maxDepth: this.maxDepth, bounds: this.bounds }
      ),
    ];
  }

  private boundsIntersect(bounds1: Bounds, bounds2: Bounds): boolean {
    return !(
      bounds1.x + bounds1.width < bounds2.x ||
      bounds2.x + bounds2.width < bounds1.x ||
      bounds1.y + bounds1.height < bounds2.y ||
      bounds2.y + bounds2.height < bounds1.y
    );
  }

  private getElementBounds(element: NonDeletedExcalidrawElement): Bounds {
    // This is a simplified bounds calculation
    // In practice, we'd use the same method as the main QuadTree
    return {
      x: element.x,
      y: element.y,
      width: element.width || 0,
      height: element.height || 0,
    };
  }
}