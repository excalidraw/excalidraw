import { CLASSES, KEYS } from "@excalidraw/common";
import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import { getBindingGap, distanceToElement } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawTextElement,
  FixedPointBinding,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { convertElementTypes } from "../components/ConvertElementTypePopup";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";
import { Keyboard } from "./helpers/ui";

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

describe("convert element type of bound and labeled arrows", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const createBoundArrow = (elbowed = false) => {
    const shape = API.createElement({
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
    return { shape, arrow };
  };

  const getArrow = () => h.elements[1] as ExcalidrawArrowElement;

  const switchLinearType = (direction: "left" | "right" = "right") => {
    let converted = false;
    act(() => {
      converted = convertElementTypes(h.app, {
        conversionType: "linear",
        direction,
      });
    });
    return converted;
  };

  const expectAttachedTo = (shapeId: string) => {
    const shape = h.elements[0] as ExcalidrawBindableElement;
    const arrow = getArrow();
    expect(shape.id).toBe(shapeId);
    expect(arrow.endBinding?.elementId).toBe(shapeId);
    const [endX, endY] = arrow.points[arrow.points.length - 1];
    const globalEnd = pointFrom<GlobalPoint>(arrow.x + endX, arrow.y + endY);
    const distance = distanceToElement(
      shape,
      h.app.scene.getNonDeletedElementsMap(),
      globalEnd,
    );
    expect(distance).toBeLessThanOrEqual(getBindingGap(shape) + 1);
  };

  it("cycles a bound arrow through the arrow types but never into a line", () => {
    const { shape } = createBoundArrow();

    switchLinearType();
    expect(getArrow().type).toBe("arrow");
    expect(getArrow().roundness).not.toBeNull();
    expectAttachedTo(shape.id);

    switchLinearType();
    expect(getArrow().type).toBe("arrow");
    expect(getArrow().elbowed).toBe(true);
    expect(getArrow().endBinding?.fixedPoint).toBeDefined();
    expectAttachedTo(shape.id);

    // wraps around to the sharp arrow, skipping "line"
    switchLinearType();
    expect(getArrow().type).toBe("arrow");
    expect(getArrow().elbowed).toBe(false);
    expect(getArrow().roundness).toBeNull();
    expectAttachedTo(shape.id);
  });

  it("cycles backwards from a sharp bound arrow to an elbow arrow", () => {
    const { shape } = createBoundArrow();

    switchLinearType("left");
    expect(getArrow().type).toBe("arrow");
    expect(getArrow().elbowed).toBe(true);
    expectAttachedTo(shape.id);
  });

  it("refuses to turn a bound arrow into a line", () => {
    const { arrow } = createBoundArrow();

    let converted = true;
    act(() => {
      converted = convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "line",
      });
    });

    expect(converted).toBe(false);
    expect(getArrow().type).toBe("arrow");
    expect(getArrow().version).toBe(arrow.version);
  });

  it("keeps the label attached when switching a labeled arrow's type", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 300,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(300, 0)],
    });
    const label = API.createElement({
      type: "text",
      containerId: arrow.id,
      text: "label",
    });
    API.setElements([
      { ...arrow, boundElements: [{ id: label.id, type: "text" }] },
      label,
    ]);
    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);

    const seenSubTypes = new Set<string>();
    for (let i = 0; i < 3; i++) {
      switchLinearType();
      const converted = h.elements[0] as ExcalidrawArrowElement;
      expect(converted.type).toBe("arrow");
      seenSubTypes.add(
        converted.elbowed ? "elbow" : converted.roundness ? "curved" : "sharp",
      );
      expect(converted.boundElements).toEqual([{ id: label.id, type: "text" }]);
      expect((h.elements[1] as ExcalidrawTextElement).containerId).toBe(
        arrow.id,
      );
    }
    expect(seenSubTypes).toEqual(new Set(["sharp", "curved", "elbow"]));
  });

  it("still offers the line type to an unbound, unlabeled arrow", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 300,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(300, 0)],
    });
    API.setElements([arrow]);
    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);

    // sharp -> curved -> elbow -> line
    switchLinearType();
    switchLinearType();
    switchLinearType();
    expect(h.elements[0].type).toBe("line");
  });

  it("hides the line option in the switcher popup for a bound arrow", () => {
    createBoundArrow();

    // Tab opens the switcher, which used to ignore bound arrows entirely
    act(() => {
      document.querySelector<HTMLElement>(".excalidraw")!.focus();
      Keyboard.keyDown(KEYS.TAB);
    });

    const popup = document.querySelector(
      `.${CLASSES.CONVERT_ELEMENT_TYPE_POPUP}`,
    );
    expect(popup).not.toBeNull();
    expect(popup!.querySelector('[aria-label="line"]')).toBeNull();
    expect(popup!.querySelector('[aria-label="sharpArrow"]')).not.toBeNull();
    expect(popup!.querySelector('[aria-label="elbowArrow"]')).not.toBeNull();
  });
});
