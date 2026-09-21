import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  FixedPointBinding,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { convertElementTypes } from "../components/ConvertElementTypePopup";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

describe("convert element type keeps bound arrows attached", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it.each([false, true])("elbowed=%s", (elbowed) => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed,
      x: 400,
      y: 50,
      width: 200,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(-200, 0)],
      endBinding: {
        elementId: rect.id,
        fixedPoint: [1, 0.25],
        mode: "orbit",
      } as FixedPointBinding,
      startBinding: null,
    });
    API.setElements([
      { ...rect, boundElements: [{ id: arrow.id, type: "arrow" }] },
      arrow,
    ]);
    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);

    const before = JSON.stringify(arrow.points);
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "generic",
        nextType: "diamond",
      });
    });
    expect(h.elements[0].type).toBe("diamond");
    const arrowAfter = h.elements[1] as ExcalidrawArrowElement;
    expect(JSON.stringify(arrowAfter.points)).not.toBe(before);

    // the arrow end should sit on the diamond outline (within the binding gap)
    const [endX, endY] = arrowAfter.points[arrowAfter.points.length - 1];
    const globalEnd = [arrowAfter.x + endX, arrowAfter.y + endY];
    const l1 =
      Math.abs(globalEnd[0] - 100) / 100 + Math.abs(globalEnd[1] - 100) / 100;
    expect(l1).toBeGreaterThan(0.95);
    expect(l1).toBeLessThan(1.2);
  });
});
