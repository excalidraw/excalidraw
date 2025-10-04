import { QuadTree } from "./QuadTree";
import type { NonDeletedExcalidrawElement, NonDeletedElementsMap } from "@excalidraw/element/types";

// Mock element for testing
const createMockElement = (id: string, x: number, y: number, width: number, height: number): NonDeletedExcalidrawElement => ({
  id,
  x,
  y,
  width,
  height,
  type: "rectangle",
  isDeleted: false,
  // Add other required properties with default values
  angle: 0,
  strokeColor: "#000000",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: "a0" as any,
  roundness: null,
  seed: 1,
  versionNonce: 1,
  updated: 1,
  link: null,
  locked: false,
  customData: null,
} as NonDeletedExcalidrawElement);

describe("QuadTree", () => {
  let quadTree: QuadTree;
  let mockElementsMap: NonDeletedElementsMap;

  beforeEach(() => {
    mockElementsMap = new Map() as NonDeletedElementsMap;
    
    const config = {
      maxElements: 4,
      maxDepth: 4,
      bounds: { x: 0, y: 0, width: 1000, height: 1000 }
    };
    
    quadTree = new QuadTree(config, mockElementsMap);
  });

  test("should insert and query elements correctly", () => {
    const element1 = createMockElement("1", 100, 100, 50, 50);
    const element2 = createMockElement("2", 200, 200, 50, 50);
    const element3 = createMockElement("3", 800, 800, 50, 50);

    // Insert elements
    quadTree.insert(element1);
    quadTree.insert(element2);
    quadTree.insert(element3);

    expect(quadTree.size()).toBe(3);

    // Query a viewport that should contain element1 and element2
    const viewport = {
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      zoom: { value: 1 },
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: 0,
      scrollY: 0,
    };

    const results = quadTree.query(viewport);
    
    // Should find elements in the queried area
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(el => el.id === "1")).toBe(true);
    expect(results.some(el => el.id === "2")).toBe(true);
  });

  test("should remove elements correctly", () => {
    const element = createMockElement("1", 100, 100, 50, 50);
    
    quadTree.insert(element);
    expect(quadTree.size()).toBe(1);
    
    quadTree.remove("1");
    expect(quadTree.size()).toBe(0);
  });

  test("should update elements correctly", () => {
    const element = createMockElement("1", 100, 100, 50, 50);
    
    quadTree.insert(element);
    
    // Update element position
    const updatedElement = { ...element, x: 500, y: 500 };
    quadTree.update(updatedElement);
    
    expect(quadTree.size()).toBe(1);
    
    // Query old position - should not find element
    const oldViewport = {
      x: 0, y: 0, width: 200, height: 200,
      zoom: { value: 1 }, offsetLeft: 0, offsetTop: 0, scrollX: 0, scrollY: 0,
    };
    
    const oldResults = quadTree.query(oldViewport);
    expect(oldResults.length).toBe(0);
    
    // Query new position - should find element
    const newViewport = {
      x: 400, y: 400, width: 200, height: 200,
      zoom: { value: 1 }, offsetLeft: 0, offsetTop: 0, scrollX: 0, scrollY: 0,
    };
    
    const newResults = quadTree.query(newViewport);
    expect(newResults.length).toBe(1);
    expect(newResults[0].id).toBe("1");
  });

  test("should handle empty queries", () => {
    const viewport = {
      x: 0, y: 0, width: 100, height: 100,
      zoom: { value: 1 }, offsetLeft: 0, offsetTop: 0, scrollX: 0, scrollY: 0,
    };
    
    const results = quadTree.query(viewport);
    expect(results).toEqual([]);
  });

  test("should provide performance statistics", () => {
    const element = createMockElement("1", 100, 100, 50, 50);
    quadTree.insert(element);
    
    const stats = quadTree.getStats();
    expect(stats.totalElements).toBe(1);
    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(stats.insertTime).toBeGreaterThanOrEqual(0);
  });
});