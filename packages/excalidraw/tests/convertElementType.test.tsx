/**
 * Regression tests for #9656 — bound arrows should be eligible for Tab
 * arrow-type switching (but not conversion to line).
 */
import {
  convertElementTypes,
  getConversionTypeFromElements,
} from "../components/ConvertElementTypePopup";
import { getLinearElementSubType } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render } from "./test-utils";

const { h } = window;

describe("issue #9656 — bound arrow Tab shape switching", () => {
  it("bound arrow is eligible for Tab shape switching", () => {
    const boundArrow = API.createElement({
      type: "arrow",
      id: "arrow-1",
      startBinding: {
        elementId: "rect-1",
        mode: "orbit",
        fixedPoint: [0.5, 0.5],
      },
      endBinding: null,
    });

    expect(getConversionTypeFromElements([boundArrow])).toBe("linear");
  });

  it("labeled arrow is eligible for Tab shape switching", () => {
    const labeledArrow = API.createElement({
      type: "arrow",
      id: "arrow-labeled",
      boundElements: [{ type: "text", id: "text-1" }],
    });

    expect(getConversionTypeFromElements([labeledArrow])).toBe("linear");
  });

  it("converting labeled arrow preserves bound text reference", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);

    const text = API.createElement({
      type: "text",
      id: "text-1",
      text: "label",
      containerId: "arrow-labeled",
    });

    const labeledArrow = API.createElement({
      type: "arrow",
      id: "arrow-labeled",
      boundElements: [{ type: "text", id: "text-1" }],
    });

    API.setElements([labeledArrow, text]);
    API.setSelectedElements([labeledArrow]);

    convertElementTypes(h.app, {
      conversionType: "linear",
      nextType: "curvedArrow",
    });

    const converted = h.elements.find((el) => el.id === "arrow-labeled")!;
    expect(getLinearElementSubType(converted as any)).toBe("curvedArrow");
    expect((converted as any).boundElements).toEqual([
      { type: "text", id: "text-1" },
    ]);
  });

  it("unbound arrow is eligible (control case)", () => {
    const arrow = API.createElement({ type: "arrow", id: "arrow-2" });
    expect(getConversionTypeFromElements([arrow])).toBe("linear");
  });

  it("converting bound arrow preserves bindings and skips line", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);

    const rect = API.createElement({
      type: "rectangle",
      id: "rect-1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      boundElements: [{ type: "arrow", id: "arrow-1" }],
    });

    const boundArrow = API.createElement({
      type: "arrow",
      id: "arrow-1",
      x: 50,
      y: 50,
      startBinding: {
        elementId: "rect-1",
        mode: "orbit",
        fixedPoint: [0.5, 0.5],
      },
      endBinding: null,
    });

    API.setElements([rect, boundArrow]);
    API.setSelectedElements([boundArrow]);

    convertElementTypes(h.app, {
      conversionType: "linear",
      nextType: "curvedArrow",
    });

    const converted = h.elements.find((el) => el.id === "arrow-1")!;
    expect(getLinearElementSubType(converted as any)).toBe("curvedArrow");
    expect((converted as any).startBinding?.elementId).toBe("rect-1");
    expect((converted as any).type).toBe("arrow");
  });
});
