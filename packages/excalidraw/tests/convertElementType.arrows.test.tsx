import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import {
  getBindingGap,
  distanceToElement,
  LinearElementEditor,
} from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawTextElementWithContainer,
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

const getArrowSubType = (arrow: ExcalidrawArrowElement) =>
  arrow.elbowed ? "elbow" : arrow.roundness ? "curved" : "sharp";

const cycleOnce = (direction: "left" | "right" = "right") => {
  act(() => {
    convertElementTypes(h.app, {
      conversionType: getConversionTypeFromElements(
        h.app.scene.getSelectedElements(h.state),
      ),
      direction,
    });
  });
};

describe("convert element type: arrows bound to shapes / with labels (#9656)", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const setupBoundArrow = (opts: { bothEnds?: boolean } = {}) => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 600,
      y: 0,
      width: 200,
      height: 200,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 200,
      y: 100,
      width: 400,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(400, 0)],
      startBinding: {
        elementId: rect.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      } as FixedPointBinding,
      endBinding: opts.bothEnds
        ? ({
            elementId: rect2.id,
            fixedPoint: [0, 0.5],
            mode: "orbit",
          } as FixedPointBinding)
        : null,
    });
    const boundElements = [{ id: arrow.id, type: "arrow" as const }];
    API.setElements([
      { ...rect, boundElements },
      opts.bothEnds ? { ...rect2, boundElements } : rect2,
      arrow,
    ]);
    const bound = h.elements.find(
      (el) => el.type === "arrow",
    ) as ExcalidrawArrowElement;
    API.setSelectedElements([bound as NonDeletedExcalidrawElement]);
    return { rectId: rect.id, rect2Id: rect2.id, arrowId: arrow.id };
  };

  it("offers the linear (arrow type) conversion for an arrow bound to a shape", () => {
    setupBoundArrow();
    expect(
      getConversionTypeFromElements(h.app.scene.getSelectedElements(h.state)),
    ).toBe("linear");
  });

  it("cycles sharp -> curved -> elbow -> sharp and never to `line`, keeping bindings", () => {
    const { rectId, arrowId } = setupBoundArrow();

    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      cycleOnce();
      const arrow = h.elements.find(
        (el) => el.id === arrowId,
      ) as ExcalidrawArrowElement;
      expect(arrow.type).toBe("arrow"); // never converted to a `line`
      expect(arrow.startBinding?.elementId).toBe(rectId); // binding retained
      seen.push(getArrowSubType(arrow));
    }
    expect(seen).toEqual([
      "curved",
      "elbow",
      "sharp",
      "curved",
      "elbow",
      "sharp",
    ]);

    // the shape must still list the arrow in boundElements
    const rect = h.elements.find((el) => el.id === rectId)!;
    expect(rect.boundElements).toEqual([{ id: arrowId, type: "arrow" }]);
  });

  it("keeps the arrow endpoint on the bound shape outline after every conversion", () => {
    const { rectId, arrowId } = setupBoundArrow();
    for (let i = 0; i < 3; i++) {
      cycleOnce();
      const arrow = h.elements.find(
        (el) => el.id === arrowId,
      ) as ExcalidrawArrowElement;
      const rect = h.elements.find((el) => el.id === rectId)!;
      const [sx, sy] = arrow.points[0];
      const distance = distanceToElement(
        rect as never,
        h.app.scene.getNonDeletedElementsMap(),
        pointFrom<GlobalPoint>(arrow.x + sx, arrow.y + sy),
      );
      expect(distance).toBeLessThanOrEqual(getBindingGap(rect as never) + 1);
    }
  });

  it("cycles backwards (Shift+Tab) without hitting `line`", () => {
    const { arrowId } = setupBoundArrow();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      cycleOnce("left");
      seen.push(
        getArrowSubType(
          h.elements.find((el) => el.id === arrowId) as ExcalidrawArrowElement,
        ),
      );
    }
    expect(seen).toEqual(["elbow", "curved", "sharp"]);
  });

  it("keeps both bindings when converting an arrow bound on both ends", () => {
    const { rectId, rect2Id, arrowId } = setupBoundArrow({ bothEnds: true });
    cycleOnce(); // -> curved
    cycleOnce(); // -> elbow
    const arrow = h.elements.find(
      (el) => el.id === arrowId,
    ) as ExcalidrawArrowElement;
    expect(arrow.elbowed).toBe(true);
    expect(arrow.startBinding?.elementId).toBe(rectId);
    expect(arrow.endBinding?.elementId).toBe(rect2Id);
    // elbow bindings are re-anchored with a fixed point on each shape
    expect(arrow.startBinding?.fixedPoint).toHaveLength(2);
    expect(arrow.endBinding?.fixedPoint).toHaveLength(2);
  });

  it("does not convert a bound arrow to `line` even when explicitly requested", () => {
    const { arrowId } = setupBoundArrow();
    act(() => {
      convertElementTypes(h.app, {
        conversionType: "linear",
        nextType: "line",
      });
    });
    const el = h.elements.find((e) => e.id === arrowId)!;
    expect(el.type).toBe("arrow");
  });

  it("allows switching arrow type for an arrow with a label and keeps the label bound", () => {
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
      text: "label",
      containerId: arrow.id,
    });
    API.setElements([
      { ...arrow, boundElements: [{ id: label.id, type: "text" }] },
      label,
    ]);
    API.setSelectedElements([h.elements[0] as NonDeletedExcalidrawElement]);

    cycleOnce(); // sharp -> curved
    const converted = h.elements.find(
      (el) => el.id === arrow.id,
    ) as ExcalidrawArrowElement;
    expect(converted.type).toBe("arrow");
    expect(getArrowSubType(converted)).toBe("curved");

    const text = h.elements.find(
      (el) => el.id === label.id,
    ) as ExcalidrawTextElementWithContainer;
    expect(text.containerId).toBe(arrow.id);
    expect(converted.boundElements).toEqual([{ id: label.id, type: "text" }]);
  });

  it("still lets an unbound, unlabeled arrow cycle through `line`", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(100, 0)],
    });
    API.setElements([arrow]);
    API.setSelectedElements([arrow as NonDeletedExcalidrawElement]);

    const types: string[] = [];
    for (let i = 0; i < 4; i++) {
      cycleOnce();
      types.push(h.elements[0].type);
    }
    // sharp -> curved -> elbow -> line -> sharp
    expect(types).toEqual(["arrow", "arrow", "line", "arrow"]);
  });

  it("keeps the label centered on the arrow after switching to elbow", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 200,
      y: 100,
      width: 400,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(400, 0)],
      startBinding: {
        elementId: rect.id,
        fixedPoint: [1, 0.5],
        mode: "orbit",
      } as FixedPointBinding,
    });
    const label = API.createElement({
      type: "text",
      text: "label",
      containerId: arrow.id,
    });
    API.setElements([
      { ...rect, boundElements: [{ id: arrow.id, type: "arrow" as const }] },
      {
        ...arrow,
        boundElements: [{ id: label.id, type: "text" as const }],
      },
      label,
    ]);
    API.setSelectedElements([h.elements[1] as NonDeletedExcalidrawElement]);

    cycleOnce(); // -> curved
    cycleOnce(); // -> elbow

    const converted = h.elements.find(
      (el) => el.id === arrow.id,
    ) as ExcalidrawArrowElement;
    const text = h.elements.find(
      (el) => el.id === label.id,
    ) as ExcalidrawTextElementWithContainer;
    expect(converted.elbowed).toBe(true);

    const expected = LinearElementEditor.getBoundTextElementPosition(
      converted,
      text,
      h.app.scene.getNonDeletedElementsMap(),
    );
    expect(Math.abs(text.x - expected.x)).toBeLessThan(1);
    expect(Math.abs(text.y - expected.y)).toBeLessThan(1);
  });
});
