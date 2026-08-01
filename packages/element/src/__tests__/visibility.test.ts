import { describe, it, expect } from "vitest";
import { isElementVisible } from "../typeChecks";
import type { ExcalidrawElement, ExcalidrawFrameElement } from "../types";

describe("Element Visibility", () => {
  it("should return true when element isVisible is true or undefined", () => {
    const visibleElement = {
      id: "elem1",
      type: "rectangle",
      isVisible: true,
    } as unknown as ExcalidrawElement;

    const defaultElement = {
      id: "elem2",
      type: "rectangle",
    } as unknown as ExcalidrawElement;

    expect(isElementVisible(visibleElement)).toBe(true);
    expect(isElementVisible(defaultElement)).toBe(true);
  });

  it("should return false when element isVisible is false", () => {
    const hiddenElement = {
      id: "elem3",
      type: "rectangle",
      isVisible: false,
    } as unknown as ExcalidrawElement;

    expect(isElementVisible(hiddenElement)).toBe(false);
  });

  it("should return false when parent frame or frame layer is hidden", () => {
    const frame = {
      id: "frame1",
      type: "frame",
      name: "Frame 1",
      isVisible: true,
      layers: [
        { id: "layer1", name: "Background", isVisible: false },
        { id: "layer2", name: "Foreground", isVisible: true },
      ],
    } as unknown as ExcalidrawFrameElement;

    const childInHiddenLayer = {
      id: "elem4",
      type: "rectangle",
      frameId: "frame1",
      layerId: "layer1",
      isVisible: true,
    } as unknown as ExcalidrawElement;

    const childInVisibleLayer = {
      id: "elem5",
      type: "rectangle",
      frameId: "frame1",
      layerId: "layer2",
      isVisible: true,
    } as unknown as ExcalidrawElement;

    const elementsMap = new Map<string, ExcalidrawElement>([
      ["frame1", frame],
      ["elem4", childInHiddenLayer],
      ["elem5", childInVisibleLayer],
    ]);

    expect(isElementVisible(childInHiddenLayer, elementsMap)).toBe(false);
    expect(isElementVisible(childInVisibleLayer, elementsMap)).toBe(true);
  });
});
