import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import {
  getBindingGap,
  distanceToElement,
  getLinearElementSubType,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  FixedPointBinding,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  convertElementTypes,
  getConversionTypeFromElements,
} from "../components/ConvertElementTypePopup";
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

  it("allows switching arrow types when arrow is bound and preserves bindings (#9656)", () => {
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
      x: 300,
      y: 100,
      width: 100,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(-100, 0)],
      startBinding: null,
      endBinding: {
        elementId: shape.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      } as FixedPointBinding,
      endArrowhead: "triangle",
    });
    API.setElements([
      { ...shape, boundElements: [{ id: arrow.id, type: "arrow" }] },
      arrow,
    ]);
    API.setSelectedElements([arrow]);

    // Bound arrow should be eligible for linear conversion
    expect(getConversionTypeFromElements([arrow])).toBe("linear");

    // Switching without nextType (Tab key) cycles: sharp -> curved
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
      });
    });
    const curvedArrow = h.elements[1] as ExcalidrawArrowElement;
    expect(getLinearElementSubType(curvedArrow)).toBe("curvedArrow");
    expect(curvedArrow.endBinding?.elementId).toBe(shape.id);
    expect(curvedArrow.endArrowhead).toBe("triangle");

    // Next cycle: curved -> elbow
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
      });
    });
    const elbowArrow = h.elements[1] as ExcalidrawArrowElement;
    expect(getLinearElementSubType(elbowArrow)).toBe("elbowArrow");
    expect(elbowArrow.endBinding?.elementId).toBe(shape.id);

    // Next cycle: elbow -> sharp (skips 'line' because arrow is bound!)
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
      });
    });
    const sharpArrow = h.elements[1] as ExcalidrawArrowElement;
    expect(getLinearElementSubType(sharpArrow)).toBe("sharpArrow");
    expect(sharpArrow.endBinding?.elementId).toBe(shape.id);

    // Explicitly requesting conversion to 'line' on bound arrow should be rejected
    let lineResult;
    act(() => {
      lineResult = convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "line",
      });
    });
    expect(lineResult).toBe(false);
    expect(h.elements[1].type).toBe("arrow");
  });
});

