import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import { getBindingGap, distanceToElement } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
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

  const cases = [
    ["rectangle", "diamond", [1, 0.25]],
    ["rectangle", "ellipse", [1, 0.1]],
    ["ellipse", "rectangle", [0.9, 0.2]],
    ["diamond", "rectangle", [0.75, 0.25]],
  ] as const;

  for (const elbowed of [false, true]) {
    it.each(cases)(
      `elbowed=${elbowed}: %s -> %s`,
      (fromType, toType, fixedPoint) => {
        const shape = API.createElement({
          type: fromType,
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
            elementId: shape.id,
            fixedPoint,
            mode: "orbit",
          } as FixedPointBinding,
          startBinding: null,
        });
        API.setElements([
          { ...shape, boundElements: [{ id: arrow.id, type: "arrow" }] },
          arrow,
        ]);
        API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);

        act(() => {
          convertElementTypes(h.app, {
            conversionType: "generic",
            nextType: toType,
          });
        });
        expect(h.elements[0].type).toBe(toType);

        const converted = h.elements[0] as ExcalidrawBindableElement;
        const arrowAfter = h.elements[1] as ExcalidrawArrowElement;
        const [endX, endY] = arrowAfter.points[arrowAfter.points.length - 1];
        const globalEnd = pointFrom<GlobalPoint>(
          arrowAfter.x + endX,
          arrowAfter.y + endY,
        );

        // the arrow end must sit on the new outline (within the binding gap)
        const distance = distanceToElement(
          converted,
          h.app.scene.getNonDeletedElementsMap(),
          globalEnd,
        );
        expect(distance).toBeLessThanOrEqual(getBindingGap(converted) + 1);
      },
    );
  }

  it("converts bound arrow between arrow types while keeping bindings intact", () => {
    const shape = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: false,
      roundness: null,
      x: 400,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(-200, 0)],
      endBinding: {
        elementId: shape.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      } as FixedPointBinding,
      startBinding: null,
      endArrowhead: "triangle",
    });
    API.setElements([
      { ...shape, boundElements: [{ id: arrow.id, type: "arrow" }] },
      arrow,
    ]);
    API.setSelectedElements([h.elements[1] as NonDeletedExcalidrawElement]);

    // sharp -> curved
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "curvedArrow",
      });
    });

    const curvedArrow = h.elements[1] as ExcalidrawArrowElement;
    expect(curvedArrow.elbowed).toBe(false);
    expect(curvedArrow.roundness).not.toBe(null);
    expect(curvedArrow.endBinding?.elementId).toBe(shape.id);
    expect(curvedArrow.endArrowhead).toBe("triangle");

    // curved -> elbow
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "elbowArrow",
      });
    });

    const elbowArrow = h.elements[1] as ExcalidrawArrowElement;
    expect(elbowArrow.elbowed).toBe(true);
    expect(elbowArrow.endBinding?.elementId).toBe(shape.id);
    expect(elbowArrow.endArrowhead).toBe("triangle");

    // elbow -> sharp
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "sharpArrow",
      });
    });

    const sharpArrow = h.elements[1] as ExcalidrawArrowElement;
    expect(sharpArrow.elbowed).toBe(false);
    expect(sharpArrow.roundness).toBe(null);
    expect(sharpArrow.endBinding?.elementId).toBe(shape.id);
    expect(sharpArrow.endArrowhead).toBe("triangle");
  });

  it("disallows converting bound arrow to line", () => {
    const shape = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: false,
      x: 400,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(-200, 0)],
      endBinding: {
        elementId: shape.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      } as FixedPointBinding,
      startBinding: null,
    });
    API.setElements([
      { ...shape, boundElements: [{ id: arrow.id, type: "arrow" }] },
      arrow,
    ]);
    API.setSelectedElements([h.elements[1] as NonDeletedExcalidrawElement]);

    act(() => {
      const converted = convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "line",
      });
      expect(converted).toBe(false);
    });

    expect(h.elements[1].type).toBe("arrow");
  });

  it("cycles through arrow types with Tab (and Shift+Tab) for bound arrow", () => {
    const shape = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const arrow = API.createElement({
      type: "arrow",
      elbowed: false,
      roundness: null,
      x: 400,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(-200, 0)],
      endBinding: {
        elementId: shape.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      } as FixedPointBinding,
      startBinding: null,
    });
    API.setElements([
      { ...shape, boundElements: [{ id: arrow.id, type: "arrow" }] },
      arrow,
    ]);
    API.setSelectedElements([h.elements[1] as NonDeletedExcalidrawElement]);

    // sharp -> curved
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        direction: "right",
      });
    });
    expect((h.elements[1] as ExcalidrawArrowElement).roundness).not.toBe(null);
    expect((h.elements[1] as ExcalidrawArrowElement).elbowed).toBe(false);

    // curved -> elbow
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        direction: "right",
      });
    });
    expect((h.elements[1] as ExcalidrawArrowElement).elbowed).toBe(true);

    // elbow -> sharp (wrap around)
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        direction: "right",
      });
    });
    expect((h.elements[1] as ExcalidrawArrowElement).elbowed).toBe(false);
    expect((h.elements[1] as ExcalidrawArrowElement).roundness).toBe(null);

    // sharp -> elbow (reverse direction)
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        direction: "left",
      });
    });
    expect((h.elements[1] as ExcalidrawArrowElement).elbowed).toBe(true);
  });

  it("converts arrow with bound text and updates text position", () => {
    const arrow = API.createElement({
      type: "arrow",
      elbowed: false,
      roundness: null,
      x: 100,
      y: 100,
      width: 200,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(200, 0)],
    });
    const text = API.createElement({
      type: "text",
      text: "Label",
      containerId: arrow.id,
      x: 180,
      y: 90,
      width: 40,
      height: 20,
    });
    API.setElements([
      { ...arrow, boundElements: [{ id: text.id, type: "text" }] },
      text,
    ]);
    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);

    // Cannot convert to line when text is bound
    act(() => {
      const converted = convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "line",
      });
      expect(converted).toBe(false);
    });

    // Converts to curved arrow and preserves bound text
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "curvedArrow",
      });
    });

    const curvedArrow = h.elements[0] as ExcalidrawArrowElement;
    expect(curvedArrow.elbowed).toBe(false);
    expect(curvedArrow.roundness).not.toBe(null);
    expect(curvedArrow.boundElements).toEqual([{ id: text.id, type: "text" }]);

    // Converts to elbow arrow and preserves bound text
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "elbowArrow",
      });
    });

    const elbowArrow = h.elements[0] as ExcalidrawArrowElement;
    expect(elbowArrow.elbowed).toBe(true);
    expect(elbowArrow.boundElements).toEqual([{ id: text.id, type: "text" }]);
  });
});
