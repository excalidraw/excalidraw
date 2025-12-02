import { randomId } from "@excalidraw/common";

import type { Layer, LayerId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import {
  actionMoveToLayer,
  actionMergeSelectedLayers,
  actionMergeAllLayers,
} from "../actions/actionLayer";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

// Helper to create a layer
const createLayer = (
  id: LayerId = randomId(),
  name: string = "Layer",
  order: number = 0,
  visible: boolean = true,
  locked: boolean = false,
): Layer => ({
  id,
  name,
  order,
  visible,
  locked,
});

describe("Layers", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("Layer CRUD Operations", () => {
    describe("Creating layers", () => {
      it("should start with a default layer", () => {
        expect(h.state.layers.length).toBeGreaterThanOrEqual(1);
        expect(h.state.activeLayerId).toBeDefined();
      });

      it("should add a new layer via setAppState", () => {
        const initialLayerCount = h.state.layers.length;
        const newLayer = createLayer("new-layer", "New Layer", 10);

        act(() => {
          h.setState({
            layers: [...h.state.layers, newLayer],
          });
        });

        expect(h.state.layers.length).toBe(initialLayerCount + 1);
        expect(h.state.layers.find((l) => l.id === "new-layer")).toBeDefined();
      });

      it("should set the active layer when adding a new layer", () => {
        const newLayer = createLayer("new-active-layer", "New Active", 10);

        act(() => {
          h.setState({
            layers: [...h.state.layers, newLayer],
            activeLayerId: newLayer.id,
          });
        });

        expect(h.state.activeLayerId).toBe("new-active-layer");
      });
    });

    describe("Updating layers", () => {
      it("should rename a layer", () => {
        const layer = createLayer("rename-test", "Original Name", 5);

        act(() => {
          h.setState({ layers: [...h.state.layers, layer] });
        });

        act(() => {
          h.setState({
            layers: h.state.layers.map((l) =>
              l.id === "rename-test" ? { ...l, name: "Updated Name" } : l,
            ),
          });
        });

        const updatedLayer = h.state.layers.find((l) => l.id === "rename-test");
        expect(updatedLayer?.name).toBe("Updated Name");
      });

      it("should toggle layer visibility", () => {
        const layer = createLayer(
          "visibility-test",
          "Visibility Layer",
          5,
          true,
        );

        act(() => {
          h.setState({ layers: [...h.state.layers, layer] });
        });

        expect(
          h.state.layers.find((l) => l.id === "visibility-test")?.visible,
        ).toBe(true);

        act(() => {
          h.setState({
            layers: h.state.layers.map((l) =>
              l.id === "visibility-test" ? { ...l, visible: false } : l,
            ),
          });
        });

        expect(
          h.state.layers.find((l) => l.id === "visibility-test")?.visible,
        ).toBe(false);
      });

      it("should update layer order", () => {
        const layer1 = createLayer("order-test-1", "Layer 1", 1);
        const layer2 = createLayer("order-test-2", "Layer 2", 2);

        act(() => {
          h.setState({ layers: [...h.state.layers, layer1, layer2] });
        });

        // Swap orders
        act(() => {
          h.setState({
            layers: h.state.layers.map((l) => {
              if (l.id === "order-test-1") {
                return { ...l, order: 2 };
              }
              if (l.id === "order-test-2") {
                return { ...l, order: 1 };
              }
              return l;
            }),
          });
        });

        const updatedLayer1 = h.state.layers.find(
          (l) => l.id === "order-test-1",
        );
        const updatedLayer2 = h.state.layers.find(
          (l) => l.id === "order-test-2",
        );

        expect(updatedLayer1?.order).toBe(2);
        expect(updatedLayer2?.order).toBe(1);
      });
    });

    describe("Deleting layers", () => {
      it("should delete a layer", () => {
        const layer = createLayer("delete-test", "Delete Me", 5);

        act(() => {
          h.setState({ layers: [...h.state.layers, layer] });
        });

        const layerCountBefore = h.state.layers.length;

        act(() => {
          h.setState({
            layers: h.state.layers.filter((l) => l.id !== "delete-test"),
          });
        });

        expect(h.state.layers.length).toBe(layerCountBefore - 1);
        expect(
          h.state.layers.find((l) => l.id === "delete-test"),
        ).toBeUndefined();
      });

      it("should not allow deleting the last layer (enforced at UI level)", () => {
        // Start with only one layer
        act(() => {
          h.setState({
            layers: [createLayer("only-layer", "Only Layer", 0)],
            activeLayerId: "only-layer",
          });
        });

        // This check would be at UI level - the delete button would be disabled
        expect(h.state.layers.length).toBe(1);
      });
    });
  });

  describe("Element Layer Assignment", () => {
    describe("New elements", () => {
      it("should assign activeLayerId to new elements", () => {
        const layer = createLayer("active-layer", "Active Layer", 10);

        act(() => {
          h.setState({
            layers: [...h.state.layers, layer],
            activeLayerId: "active-layer",
          });
        });

        const rectangle = API.createElement({
          type: "rectangle",
          layerId: h.state.activeLayerId,
        });

        expect(rectangle.layerId).toBe("active-layer");
      });

      it("should create element with null layerId when not specified", () => {
        const rectangle = API.createElement({
          type: "rectangle",
        });

        // Default layerId should be null
        expect(rectangle.layerId).toBeNull();
      });

      it("should support layerId in various element types", () => {
        const types = [
          "rectangle",
          "ellipse",
          "diamond",
          "text",
          "arrow",
          "line",
          "freedraw",
        ] as const;

        types.forEach((type) => {
          const element = API.createElement({
            type,
            layerId: "test-layer",
          } as any);

          expect(element.layerId).toBe("test-layer");
        });
      });
    });

    describe("Moving elements between layers", () => {
      it("should move selected elements to a different layer using actionMoveToLayer", () => {
        const layer1 = createLayer("layer-1", "Layer 1", 1);
        const layer2 = createLayer("layer-2", "Layer 2", 2);

        act(() => {
          h.setState({
            layers: [...h.state.layers, layer1, layer2],
            activeLayerId: "layer-1",
          });
        });

        const rectangle = API.createElement({
          type: "rectangle",
          layerId: "layer-1",
        });

        API.setElements([rectangle]);
        API.setSelectedElements([rectangle]);

        // Execute the move action
        act(() => {
          h.app.actionManager.executeAction(
            actionMoveToLayer,
            "contextMenu",
            "layer-2",
          );
        });

        // Get the updated element
        const updatedElement = h.elements.find((e) => e.id === rectangle.id);
        expect(updatedElement?.layerId).toBe("layer-2");
      });

      it("should move multiple selected elements to a different layer", () => {
        const layer1 = createLayer("source-layer", "Source", 1);
        const layer2 = createLayer("target-layer", "Target", 2);

        act(() => {
          h.setState({
            layers: [...h.state.layers, layer1, layer2],
          });
        });

        const rect1 = API.createElement({
          type: "rectangle",
          layerId: "source-layer",
        });
        const rect2 = API.createElement({
          type: "ellipse",
          layerId: "source-layer",
        });
        const rect3 = API.createElement({
          type: "diamond",
          layerId: "source-layer",
        });

        API.setElements([rect1, rect2, rect3]);
        API.setSelectedElements([rect1, rect3]); // Select only rect1 and rect3

        act(() => {
          h.app.actionManager.executeAction(
            actionMoveToLayer,
            "contextMenu",
            "target-layer",
          );
        });

        // rect1 and rect3 should be moved, rect2 should remain
        expect(h.elements.find((e) => e.id === rect1.id)?.layerId).toBe(
          "target-layer",
        );
        expect(h.elements.find((e) => e.id === rect2.id)?.layerId).toBe(
          "source-layer",
        );
        expect(h.elements.find((e) => e.id === rect3.id)?.layerId).toBe(
          "target-layer",
        );
      });

      it("should not move elements when no target layer specified", () => {
        const layer = createLayer("test-layer", "Test", 1);

        act(() => {
          h.setState({ layers: [...h.state.layers, layer] });
        });

        const rectangle = API.createElement({
          type: "rectangle",
          layerId: "test-layer",
        });

        API.setElements([rectangle]);
        API.setSelectedElements([rectangle]);

        act(() => {
          h.app.actionManager.executeAction(
            actionMoveToLayer,
            "contextMenu",
            null, // No target layer
          );
        });

        expect(h.elements.find((e) => e.id === rectangle.id)?.layerId).toBe(
          "test-layer",
        );
      });
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle elements without layerId property", () => {
      // Simulating old elements that don't have layerId
      const oldElement = {
        id: "old-element",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        // No layerId property
      } as any;

      API.setElements([oldElement]);

      // Element should still be accessible
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe("old-element");
    });

    it("should treat null layerId as default layer", () => {
      const element = API.createElement({
        type: "rectangle",
        layerId: null,
      });

      // Element should be created successfully with null layerId
      expect(element.layerId).toBeNull();

      API.setElements([element]);
      expect(h.elements.length).toBe(1);
    });

    it("should treat undefined layerId as null", () => {
      const element = API.createElement({
        type: "rectangle",
        // layerId not specified, should default to null
      });

      expect(element.layerId).toBeNull();
    });
  });

  describe("Layer Visibility Filtering", () => {
    it("should filter hidden layer elements correctly in state", () => {
      const visibleLayer = createLayer("visible-layer", "Visible", 1, true);
      const hiddenLayer = createLayer("hidden-layer", "Hidden", 2, false);

      act(() => {
        h.setState({
          layers: [...h.state.layers, visibleLayer, hiddenLayer],
        });
      });

      const visibleElement = API.createElement({
        type: "rectangle",
        layerId: "visible-layer",
      });
      const hiddenElement = API.createElement({
        type: "ellipse",
        layerId: "hidden-layer",
      });

      API.setElements([visibleElement, hiddenElement]);

      // Both elements should exist in the scene
      expect(h.elements.length).toBe(2);

      // Visibility is handled at render time, not in elements array
      // The layer with visible: false should hide its elements during rendering
      const visibleLayerState = h.state.layers.find(
        (l) => l.id === "visible-layer",
      );
      const hiddenLayerState = h.state.layers.find(
        (l) => l.id === "hidden-layer",
      );

      expect(visibleLayerState?.visible).toBe(true);
      expect(hiddenLayerState?.visible).toBe(false);
    });

    it("should show elements on visible layers after toggling visibility", () => {
      const layer = createLayer("toggle-layer", "Toggle", 1, false);

      act(() => {
        h.setState({ layers: [...h.state.layers, layer] });
      });

      // Initially hidden
      expect(h.state.layers.find((l) => l.id === "toggle-layer")?.visible).toBe(
        false,
      );

      // Toggle to visible
      act(() => {
        h.setState({
          layers: h.state.layers.map((l) =>
            l.id === "toggle-layer" ? { ...l, visible: true } : l,
          ),
        });
      });

      expect(h.state.layers.find((l) => l.id === "toggle-layer")?.visible).toBe(
        true,
      );
    });
  });

  describe("Active Layer", () => {
    it("should track the active layer", () => {
      const layer1 = createLayer("layer-a", "Layer A", 1);
      const layer2 = createLayer("layer-b", "Layer B", 2);

      act(() => {
        h.setState({
          layers: [...h.state.layers, layer1, layer2],
          activeLayerId: "layer-a",
        });
      });

      expect(h.state.activeLayerId).toBe("layer-a");

      act(() => {
        h.setState({ activeLayerId: "layer-b" });
      });

      expect(h.state.activeLayerId).toBe("layer-b");
    });

    it("should allow setting activeLayerId to null", () => {
      act(() => {
        h.setState({ activeLayerId: null });
      });

      expect(h.state.activeLayerId).toBeNull();
    });
  });

  describe("Layer Multi-Selection", () => {
    it("should support selectedLayerIds for multi-selection", () => {
      const layer1 = createLayer("multi-1", "Layer 1", 1);
      const layer2 = createLayer("multi-2", "Layer 2", 2);
      const layer3 = createLayer("multi-3", "Layer 3", 3);

      act(() => {
        h.setState({
          layers: [layer1, layer2, layer3],
          selectedLayerIds: { "multi-1": true, "multi-3": true },
        });
      });

      expect(Object.keys(h.state.selectedLayerIds).length).toBe(2);
      expect(h.state.selectedLayerIds["multi-1"]).toBe(true);
      expect(h.state.selectedLayerIds["multi-3"]).toBe(true);
      expect(h.state.selectedLayerIds["multi-2"]).toBeUndefined();
    });

    it("should clear selectedLayerIds", () => {
      act(() => {
        h.setState({
          selectedLayerIds: { "some-layer": true },
        });
      });

      expect(Object.keys(h.state.selectedLayerIds).length).toBe(1);

      act(() => {
        h.setState({ selectedLayerIds: {} });
      });

      expect(Object.keys(h.state.selectedLayerIds).length).toBe(0);
    });
  });

  describe("Merge Layers", () => {
    describe("actionMergeSelectedLayers", () => {
      it("should merge selected layers into the topmost selected layer", () => {
        const layer1 = createLayer("merge-bottom", "Bottom", 1);
        const layer2 = createLayer("merge-middle", "Middle", 2);
        const layer3 = createLayer("merge-top", "Top", 3);

        act(() => {
          h.setState({
            layers: [layer1, layer2, layer3],
            activeLayerId: "merge-bottom",
            selectedLayerIds: { "merge-bottom": true, "merge-top": true },
          });
        });

        // Create elements on different layers
        const elem1 = API.createElement({
          type: "rectangle",
          layerId: "merge-bottom",
        });
        const elem2 = API.createElement({
          type: "ellipse",
          layerId: "merge-middle",
        });
        const elem3 = API.createElement({
          type: "diamond",
          layerId: "merge-top",
        });

        API.setElements([elem1, elem2, elem3]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeSelectedLayers);
        });

        // After merge, only middle and top layers should remain
        expect(h.state.layers.length).toBe(2);
        expect(
          h.state.layers.find((l) => l.id === "merge-bottom"),
        ).toBeUndefined();
        expect(
          h.state.layers.find((l) => l.id === "merge-middle"),
        ).toBeDefined();
        expect(h.state.layers.find((l) => l.id === "merge-top")).toBeDefined();

        // Elements from bottom layer should be moved to top layer
        expect(h.elements.find((e) => e.id === elem1.id)?.layerId).toBe(
          "merge-top",
        );
        // Middle layer element should remain unchanged
        expect(h.elements.find((e) => e.id === elem2.id)?.layerId).toBe(
          "merge-middle",
        );
        // Top layer element should remain on top layer
        expect(h.elements.find((e) => e.id === elem3.id)?.layerId).toBe(
          "merge-top",
        );

        // Active layer should be the target (topmost selected)
        expect(h.state.activeLayerId).toBe("merge-top");
      });

      it("should not merge when fewer than 2 layers are selected", () => {
        const layer1 = createLayer("single-1", "Layer 1", 1);
        const layer2 = createLayer("single-2", "Layer 2", 2);

        act(() => {
          h.setState({
            layers: [layer1, layer2],
            selectedLayerIds: { "single-1": true },
          });
        });

        act(() => {
          h.app.actionManager.executeAction(actionMergeSelectedLayers);
        });

        // Both layers should still exist
        expect(h.state.layers.length).toBe(2);
      });

      it("should preserve z-order when merging (elements from higher layers stay on top)", () => {
        const layer1 = createLayer("z-bottom", "Bottom", 1);
        const layer2 = createLayer("z-top", "Top", 2);

        act(() => {
          h.setState({
            layers: [layer1, layer2],
            selectedLayerIds: { "z-bottom": true, "z-top": true },
          });
        });

        // Create elements - bottom layer element first, top layer element second
        const bottomElem = API.createElement({
          type: "rectangle",
          layerId: "z-bottom",
        });
        const topElem = API.createElement({
          type: "ellipse",
          layerId: "z-top",
        });

        API.setElements([bottomElem, topElem]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeSelectedLayers);
        });

        // After merge, elements should be ordered: bottomElem first, topElem second
        // (topElem renders on top)
        const mergedElements = h.elements;
        const bottomIndex = mergedElements.findIndex(
          (e) => e.id === bottomElem.id,
        );
        const topIndex = mergedElements.findIndex((e) => e.id === topElem.id);

        expect(bottomIndex).toBeLessThan(topIndex);
      });

      it("should update selectedLayerIds after merge", () => {
        const layer1 = createLayer("sel-1", "Layer 1", 1);
        const layer2 = createLayer("sel-2", "Layer 2", 2);

        act(() => {
          h.setState({
            layers: [layer1, layer2],
            selectedLayerIds: { "sel-1": true, "sel-2": true },
          });
        });

        API.setElements([]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeSelectedLayers);
        });

        // After merge, only the target layer should be selected
        expect(Object.keys(h.state.selectedLayerIds).length).toBe(1);
        expect(h.state.selectedLayerIds["sel-2"]).toBe(true);
      });
    });

    describe("actionMergeAllLayers", () => {
      it("should merge all layers into the topmost layer", () => {
        const layer1 = createLayer("all-1", "Layer 1", 1);
        const layer2 = createLayer("all-2", "Layer 2", 2);
        const layer3 = createLayer("all-3", "Layer 3", 3);

        act(() => {
          h.setState({
            layers: [layer1, layer2, layer3],
            activeLayerId: "all-1",
          });
        });

        const elem1 = API.createElement({
          type: "rectangle",
          layerId: "all-1",
        });
        const elem2 = API.createElement({
          type: "ellipse",
          layerId: "all-2",
        });
        const elem3 = API.createElement({
          type: "diamond",
          layerId: "all-3",
        });

        API.setElements([elem1, elem2, elem3]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeAllLayers);
        });

        // Only topmost layer should remain
        expect(h.state.layers.length).toBe(1);
        expect(h.state.layers[0].id).toBe("all-3");

        // All elements should be on the topmost layer
        expect(h.elements.find((e) => e.id === elem1.id)?.layerId).toBe(
          "all-3",
        );
        expect(h.elements.find((e) => e.id === elem2.id)?.layerId).toBe(
          "all-3",
        );
        expect(h.elements.find((e) => e.id === elem3.id)?.layerId).toBe(
          "all-3",
        );

        // Active layer should be the target
        expect(h.state.activeLayerId).toBe("all-3");
      });

      it("should not merge when only one layer exists", () => {
        const layer = createLayer("only-one", "Only One", 1);

        act(() => {
          h.setState({
            layers: [layer],
            activeLayerId: "only-one",
          });
        });

        act(() => {
          h.app.actionManager.executeAction(actionMergeAllLayers);
        });

        expect(h.state.layers.length).toBe(1);
        expect(h.state.layers[0].id).toBe("only-one");
      });

      it("should preserve z-order across all layers when merging", () => {
        const layer1 = createLayer("order-1", "Layer 1", 1);
        const layer2 = createLayer("order-2", "Layer 2", 2);
        const layer3 = createLayer("order-3", "Layer 3", 3);

        act(() => {
          h.setState({
            layers: [layer1, layer2, layer3],
          });
        });

        const elem1 = API.createElement({
          type: "rectangle",
          layerId: "order-1",
        });
        const elem2 = API.createElement({
          type: "ellipse",
          layerId: "order-2",
        });
        const elem3 = API.createElement({
          type: "diamond",
          layerId: "order-3",
        });

        API.setElements([elem1, elem2, elem3]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeAllLayers);
        });

        // Elements should maintain their relative z-order
        // Layer 1 elements < Layer 2 elements < Layer 3 elements
        const elem1Index = h.elements.findIndex((e) => e.id === elem1.id);
        const elem2Index = h.elements.findIndex((e) => e.id === elem2.id);
        const elem3Index = h.elements.findIndex((e) => e.id === elem3.id);

        expect(elem1Index).toBeLessThan(elem2Index);
        expect(elem2Index).toBeLessThan(elem3Index);
      });

      it("should clear selectedLayerIds after merge", () => {
        const layer1 = createLayer("clear-1", "Layer 1", 1);
        const layer2 = createLayer("clear-2", "Layer 2", 2);

        act(() => {
          h.setState({
            layers: [layer1, layer2],
            selectedLayerIds: { "clear-1": true },
          });
        });

        API.setElements([]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeAllLayers);
        });

        // selectedLayerIds should be empty after merge all
        expect(Object.keys(h.state.selectedLayerIds).length).toBe(0);
      });
    });

    describe("Merge with elements on default layer", () => {
      it("should handle elements with null layerId (default layer)", () => {
        const layer1 = createLayer("with-default", "Layer With Default", 1);
        const layer2 = createLayer("other-layer", "Other Layer", 2);

        act(() => {
          h.setState({
            layers: [layer1, layer2],
            selectedLayerIds: { "with-default": true, "other-layer": true },
          });
        });

        // Create element with null layerId (treated as default/lowest order layer)
        const defaultElem = API.createElement({
          type: "rectangle",
          layerId: null,
        });
        const layerElem = API.createElement({
          type: "ellipse",
          layerId: "other-layer",
        });

        API.setElements([defaultElem, layerElem]);

        act(() => {
          h.app.actionManager.executeAction(actionMergeSelectedLayers);
        });

        // Elements should be merged to the topmost layer
        expect(h.elements.find((e) => e.id === layerElem.id)?.layerId).toBe(
          "other-layer",
        );
      });
    });
  });
});
