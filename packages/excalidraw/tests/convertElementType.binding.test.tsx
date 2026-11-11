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
});
