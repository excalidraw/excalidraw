import { isElementInVisibleLayer, getElementLayer } from "../src/layer";

import type { ExcalidrawElement, Layer } from "../src/types";

// Helper to create a mock element with layerId
const createMockElement = (layerId: string | null = null): ExcalidrawElement =>
  ({
    id: "test-element",
    type: "rectangle",
    layerId,
    isDeleted: false,
  } as ExcalidrawElement);

// Helper to create mock layers
const createMockLayers = (
  configs: Array<{ id: string; visible: boolean; order: number }>,
): readonly Layer[] =>
  configs.map(({ id, visible, order }) => ({
    id,
    name: `Layer ${id}`,
    visible,
    locked: false,
    order,
  }));

describe("isElementInVisibleLayer", () => {
  describe("with no layers", () => {
    it("should return true when layers array is empty", () => {
      const element = createMockElement("layer-1");
      const layers: readonly Layer[] = [];

      expect(isElementInVisibleLayer(element, layers)).toBe(true);
    });

    it("should return true for element with null layerId when layers array is empty", () => {
      const element = createMockElement(null);
      const layers: readonly Layer[] = [];

      expect(isElementInVisibleLayer(element, layers)).toBe(true);
    });
  });

  describe("with visible layers", () => {
    it("should return true when element is on a visible layer", () => {
      const element = createMockElement("layer-1");
      const layers = createMockLayers([
        { id: "layer-1", visible: true, order: 1 },
      ]);

      expect(isElementInVisibleLayer(element, layers)).toBe(true);
    });

    it("should return true for element with null layerId (defaults to visible)", () => {
      const element = createMockElement(null);
      const layers = createMockLayers([
        { id: "default-layer", visible: true, order: 0 },
      ]);

      // Element without explicit layerId should be visible
      // (treated as default layer or always visible)
      expect(isElementInVisibleLayer(element, layers)).toBe(true);
    });
  });

  describe("with hidden layers", () => {
    it("should return false when element is on a hidden layer", () => {
      const element = createMockElement("layer-1");
      const layers = createMockLayers([
        { id: "layer-1", visible: false, order: 1 },
      ]);

      expect(isElementInVisibleLayer(element, layers)).toBe(false);
    });

    it("should correctly filter elements across multiple layers", () => {
      const layers = createMockLayers([
        { id: "visible-layer", visible: true, order: 2 },
        { id: "hidden-layer", visible: false, order: 1 },
      ]);

      const visibleElement = createMockElement("visible-layer");
      const hiddenElement = createMockElement("hidden-layer");

      expect(isElementInVisibleLayer(visibleElement, layers)).toBe(true);
      expect(isElementInVisibleLayer(hiddenElement, layers)).toBe(false);
    });
  });

  describe("with unknown layer reference", () => {
    it("should return true when element references non-existent layer", () => {
      // Elements referencing unknown layers should be visible
      // (defensive: don't hide elements with orphaned layer references)
      const element = createMockElement("non-existent-layer");
      const layers = createMockLayers([
        { id: "layer-1", visible: true, order: 1 },
      ]);

      expect(isElementInVisibleLayer(element, layers)).toBe(true);
    });
  });
});

describe("getElementLayer", () => {
  it("should return the layer when element has matching layerId", () => {
    const element = createMockElement("layer-1");
    const layers = createMockLayers([
      { id: "layer-1", visible: true, order: 1 },
      { id: "layer-2", visible: true, order: 2 },
    ]);

    const result = getElementLayer(element, layers);

    expect(result).toBeDefined();
    expect(result?.id).toBe("layer-1");
  });

  it("should return undefined when element has null layerId and no default layer matches", () => {
    const element = createMockElement(null);
    const layers = createMockLayers([
      { id: "layer-1", visible: true, order: 1 },
    ]);

    // The function looks for DEFAULT_LAYER_ID which won't match "layer-1"
    const result = getElementLayer(element, layers);

    // Should return undefined since no layer matches DEFAULT_LAYER_ID
    expect(result).toBeUndefined();
  });

  it("should return undefined when layers array is empty", () => {
    const element = createMockElement("layer-1");
    const layers: readonly Layer[] = [];

    const result = getElementLayer(element, layers);

    expect(result).toBeUndefined();
  });

  it("should return undefined when element references non-existent layer", () => {
    const element = createMockElement("non-existent");
    const layers = createMockLayers([
      { id: "layer-1", visible: true, order: 1 },
    ]);

    const result = getElementLayer(element, layers);

    expect(result).toBeUndefined();
  });
});
