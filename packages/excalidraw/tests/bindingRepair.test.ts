import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  Scene,
  repairBindings,
  updateBoundElements,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

const REPAIR_ALL = { warn: false } as const;

const arrowEndpoint = (
  arrow: ExcalidrawArrowElement,
  index: number,
): [number, number] => {
  const point = arrow.points.at(index)!;
  return [arrow.x + point[0], arrow.y + point[1]];
};

describe("repairBindings", () => {
  it("returns an empty array for an empty scene", () => {
    expect(repairBindings([])).toEqual([]);
  });

  it("does not mutate the input elements", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      x: 100,
      y: 50,
      points: [pointFrom(0, 0), pointFrom(50, 0)],
      startBinding: {
        elementId: "missing",
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
      endBinding: null,
    });

    const input = [rect, arrow];
    const snapshot = JSON.stringify(input);

    repairBindings(input, REPAIR_ALL);

    expect(JSON.stringify(input)).toEqual(snapshot);
  });

  describe("unbindDangling", () => {
    it("drops a binding to a missing element and clears the record on the target", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["unbindDangling"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedArrow.startBinding).toBeNull();
      expect(fixedArrow.endBinding?.elementId).toBe("rect");
      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("drops a binding whose target is deleted", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        isDeleted: true,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      // a deleted target is absent from the non-deleted map, so this used to
      // throw inside `unbindBindingElement` rather than clear the binding
      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedArrow.startBinding).toBeNull();
      // the deleted target keeps its record untouched
      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("re-binds a dangling end to a shape the endpoint already touches", () => {
      // the full pipeline drops the dangling binding and then infers a fresh
      // one, because the endpoint genuinely sits on `rect`
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.elementId).toBe("rect");
    });

    it("keeps a binding when only one end is dangling", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "nope",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["unbindDangling"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedArrow.startBinding).toBeNull();
      expect(fixedArrow.endBinding).not.toBeNull();
      // the surviving binding still keeps the arrow on the target
      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("honours the arrowIds scope, like every other arrow-side action", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([arrow], {
        ...REPAIR_ALL,
        actions: ["unbindDangling"],
        arrowIds: ["some-other-arrow"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      // out of scope, so the dangling binding is left untouched
      expect(fixedArrow.startBinding?.elementId).toBe("missing");
    });
  });

  describe("pruneBoundElements", () => {
    it("drops a stale record pointing at a deleted element", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [
          { id: "gone", type: "arrow" },
          { id: "present", type: "arrow" },
        ],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "present",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedRect.boundElements).toEqual([
        { id: "present", type: "arrow" },
      ]);
    });

    it("drops a record whose element no longer binds back", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      // arrow exists but declares no binding to rect
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 500,
        y: 500,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["pruneBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedRect.boundElements).toEqual([]);
    });

    it("fixes the type of a record that otherwise binds back", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        // text element recorded as an arrow: `getBoundTextElementId` looks
        // bound text up by `type === "text"`, so this record stops resolving
        boundElements: [{ id: "text", type: "arrow" }],
      });
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        text: "hi",
        containerId: "rect",
      });

      const fixed = repairBindings([rect, text], {
        ...REPAIR_ALL,
        actions: ["pruneBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;
      const fixedText = fixed.find(
        (el) => el.id === "text",
      ) as ExcalidrawTextElement;

      // the record is corrected rather than dropped, so the label stays bound
      // on both sides
      expect(fixedRect.boundElements).toEqual([{ id: "text", type: "text" }]);
      expect(fixedText.containerId).toBe("rect");
    });

    it("drops a mistyped record that does not bind back", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "text", type: "arrow" }],
      });
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        text: "hi",
        containerId: null,
      });

      const fixed = repairBindings([rect, text], {
        ...REPAIR_ALL,
        actions: ["pruneBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedRect.boundElements).toEqual([]);
    });

    it("keeps a record whose type matches", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "text", type: "text" }],
      });
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 0,
        y: 0,
        width: 50,
        height: 20,
        text: "hi",
        containerId: "rect",
      });

      const fixed = repairBindings([rect, text], {
        ...REPAIR_ALL,
        actions: ["pruneBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedRect.boundElements).toEqual([{ id: "text", type: "text" }]);
    });
  });

  describe("linkBoundElements", () => {
    it("backfills the target ledger when only the arrow declares the binding", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: null,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedRect = fixed.find((el) => el.id === "rect")!;
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
      expect(fixedArrow.startBinding?.elementId).toBe("rect");
    });

    it("leaves a binding to a dangling target for unbindDangling", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding).toBeNull();
    });

    it("is a no-op when the target already lists the arrow", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["linkBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      // no duplicate record, and the ledger is byte-for-byte what came in
      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("records an arrow bound to the same target at both ends once", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: null,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom(0, 50), pointFrom(50, 0), pointFrom(100, 50)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["linkBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("honours the arrowIds scope", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: null,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["linkBoundElements"],
        arrowIds: ["other"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedRect.boundElements).toBeNull();
    });

    it("makes the arrow follow a moved target (regression)", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: null,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const scene = new Scene(fixed, { skipValidation: true });
      const movedRect = scene
        .getElementsMapIncludingDeleted()
        .get("rect") as any;
      const beforeArrow = scene
        .getElementsMapIncludingDeleted()
        .get("arrow") as any;
      const beforeX = beforeArrow.x;

      // what a drag does: move the container, then run the bound-element update
      movedRect.x = 500;
      updateBoundElements(movedRect, scene);

      const afterArrow = scene
        .getElementsMapIncludingDeleted()
        .get("arrow") as any;

      // with the ledger backfilled the arrow tracks the container instead of
      // staying put, which is what happened before the fix
      expect(afterArrow.x).toBeGreaterThan(beforeX);
      expect(afterArrow.x).toBeGreaterThan(400);
    });
  });

  describe("dedupeBoundElements", () => {
    it("keeps the first occurrence and preserves listing order", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [
          { id: "a", type: "arrow" },
          { id: "b", type: "arrow" },
          { id: "a", type: "arrow" },
        ],
      });

      const fixed = repairBindings([rect], {
        ...REPAIR_ALL,
        actions: ["dedupeBoundElements"],
      });
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      // `a` keeps its original position; the later duplicate is dropped
      expect(fixedRect.boundElements).toEqual([
        { id: "a", type: "arrow" },
        { id: "b", type: "arrow" },
      ]);
    });
  });

  describe("inferMissingBindings", () => {
    it("binds an arrow endpoint that touches a shape without declaring a binding", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      // start point sits exactly on the rect's right edge
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedArrow.startBinding).toEqual(
        expect.objectContaining({ elementId: "rect" }),
      );
      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    describe("see-through group boxes", () => {
      const groupBox = () =>
        API.createElement({
          type: "rectangle",
          id: "group",
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          backgroundColor: "transparent",
        });
      const innerRect = () =>
        API.createElement({
          type: "rectangle",
          id: "inner",
          x: 300,
          y: 200,
          width: 100,
          height: 100,
        });

      it("does not bind an arrow lying entirely inside the box", () => {
        const arrow = API.createElement({
          type: "arrow",
          id: "arrow",
          x: 100,
          y: 250,
          points: [pointFrom(0, 0), pointFrom(100, 0)],
          startBinding: null,
          endBinding: null,
        });

        const fixed = repairBindings([groupBox(), arrow], REPAIR_ALL);
        const fixedArrow = fixed.find(
          (el) => el.id === "arrow",
        ) as ExcalidrawArrowElement;
        const fixedGroup = fixed.find((el) => el.id === "group")!;

        expect(fixedArrow.startBinding).toBeNull();
        expect(fixedArrow.endBinding).toBeNull();
        expect(fixedGroup.boundElements ?? []).toEqual([]);
      });

      it("binds the end that reaches an inner shape, not the box", () => {
        const arrow = API.createElement({
          type: "arrow",
          id: "arrow",
          x: 100,
          y: 250,
          // end sits on the inner rect's left edge, start falls short of
          // anything
          points: [pointFrom(0, 0), pointFrom(200, 0)],
          startBinding: null,
          endBinding: null,
        });

        const fixed = repairBindings(
          [groupBox(), innerRect(), arrow],
          REPAIR_ALL,
        );
        const fixedArrow = fixed.find(
          (el) => el.id === "arrow",
        ) as ExcalidrawArrowElement;

        expect(fixedArrow.startBinding).toBeNull();
        expect(fixedArrow.endBinding?.elementId).toBe("inner");
      });

      it("still binds inside when the arrow points in from outside", () => {
        const arrow = API.createElement({
          type: "arrow",
          id: "arrow",
          x: -200,
          y: 250,
          points: [pointFrom(0, 0), pointFrom(300, 0)],
          startBinding: null,
          endBinding: null,
        });

        const fixed = repairBindings([groupBox(), arrow], REPAIR_ALL);
        const fixedArrow = fixed.find(
          (el) => el.id === "arrow",
        ) as ExcalidrawArrowElement;

        expect(fixedArrow.startBinding).toBeNull();
        expect(fixedArrow.endBinding).toEqual(
          expect.objectContaining({ elementId: "group", mode: "inside" }),
        );
      });

      it("still binds center-to-center arrows between separate boxes", () => {
        const a = API.createElement({
          type: "rectangle",
          id: "a",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        });
        const b = API.createElement({
          type: "rectangle",
          id: "b",
          x: 300,
          y: 0,
          width: 100,
          height: 100,
        });
        const arrow = API.createElement({
          type: "arrow",
          id: "arrow",
          x: 50,
          y: 50,
          points: [pointFrom(0, 0), pointFrom(300, 0)],
          startBinding: null,
          endBinding: null,
        });

        const fixed = repairBindings([a, b, arrow], REPAIR_ALL);
        const fixedArrow = fixed.find(
          (el) => el.id === "arrow",
        ) as ExcalidrawArrowElement;

        expect(fixedArrow.startBinding).toEqual(
          expect.objectContaining({ elementId: "a", mode: "inside" }),
        );
        expect(fixedArrow.endBinding).toEqual(
          expect.objectContaining({ elementId: "b", mode: "inside" }),
        );
      });
    });

    it("leaves an endpoint alone when no bindable element is in reach", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 1000,
        y: 1000,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedArrow.startBinding).toBeNull();
      expect(fixedArrow.endBinding).toBeNull();
      expect(fixedRect.boundElements).toBeNull();
    });

    it("honours the arrowIds scope", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        arrowIds: ["some-other-arrow"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding).toBeNull();
    });

    it("does not bind an endpoint that merely passes near a shape", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      // ~200px away, well outside the binding reach
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 300,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding).toBeNull();
    });

    it("widens the reach with the tolerance option", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      // ~20px to the right of the rect edge
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 120,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const withoutTolerance = repairBindings([rect, arrow], REPAIR_ALL).find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      expect(withoutTolerance.startBinding).toBeNull();

      const withTolerance = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        tolerance: 30,
      }).find((el) => el.id === "arrow") as ExcalidrawArrowElement;
      expect(withTolerance.startBinding).toEqual(
        expect.objectContaining({ elementId: "rect" }),
      );
    });
  });

  describe("reanchorBindings", () => {
    it("re-derives a stale fixedPoint after the target moved", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          // stale: rect now sits at x=200
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 200,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["reanchorBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.elementId).toBe("rect");
      expect(fixedArrow.startBinding?.fixedPoint).toEqual(
        expect.arrayContaining([expect.any(Number), expect.any(Number)]),
      );
      expect(fixedArrow.startBinding?.mode).toBe("orbit");
    });

    it.each([
      // endpoint just outside the rect's left edge
      { x: 95, expected: "orbit" },
      // endpoint well inside the rect
      { x: 150, expected: "inside" },
    ])("infers a missing mode as $expected", ({ x, expected }) => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 100,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(-50, 0)],
        // generator omitted `mode`
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
        } as any,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["reanchorBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.elementId).toBe("rect");
      expect(fixedArrow.startBinding?.mode).toBe(expected);
    });

    it("keeps a valid explicit mode", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 100,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        // endpoint inside the rect, which would infer "inside"
        x: 150,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(-100, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["reanchorBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.mode).toBe("orbit");
    });

    it("restores a missing fixedPoint", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 100,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: undefined as unknown as [number, number],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["reanchorBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.fixedPoint).toEqual(
        expect.arrayContaining([expect.any(Number), expect.any(Number)]),
      );
    });
  });

  describe("snapToOutline", () => {
    it("moves a bound endpoint back onto the target outline", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      // start endpoint drifted far inside/through the rect
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 40,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(60, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const before = arrowEndpoint(arrow as ExcalidrawArrowElement, 0);

      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["snapToOutline"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      const after = arrowEndpoint(fixedArrow, 0);

      // the endpoint moved (x no longer 40) and now sits on the right edge
      expect(after[0]).not.toEqual(before[0]);
      expect(Math.abs(after[0] - 100)).toBeLessThan(10);
    });
  });

  describe("action selection", () => {
    it("runs only the requested actions", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      // `unbindDangling` is not selected, so the dangling binding survives
      const fixed = repairBindings([rect, arrow], {
        ...REPAIR_ALL,
        actions: ["inferMissingBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.elementId).toBe("missing");
    });
  });

  describe("idempotency", () => {
    it("produces the same result when run twice", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const once = repairBindings([rect, arrow], REPAIR_ALL);
      const twice = repairBindings(once, REPAIR_ALL);

      const normalize = (elements: readonly ExcalidrawElement[]) =>
        elements.map((el) => {
          const { version, versionNonce, updated, ...rest } = el as any;
          void version;
          void versionNonce;
          void updated;
          return rest;
        });

      expect(normalize(twice)).toEqual(normalize(once));
    });
  });

  describe("warnings", () => {
    it("warns when an unfixable binding is dropped", () => {
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      repairBindings([arrow], { warn: true });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("which is missing or deleted"),
      );
      warnSpy.mockRestore();
    });

    it("stays silent when warn is false", () => {
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "missing",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      repairBindings([arrow], { warn: false });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not warn for a dangling end that inference then rebinds", () => {
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: null,
      });
      // the start endpoint sits on rect's outline, so after unbindDangling
      // drops the stale target, inferMissingBindings re-binds it
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "stale",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], { warn: true });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      // the repair succeeded, so nothing is reported
      expect(fixedArrow.startBinding?.elementId).toBe("rect");
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("fractional indices", () => {
    it("normalizes missing indices so the result is usable as an ordered scene", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        index: null,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        index: null,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);

      expect(fixed.map((el) => el.index)).toEqual(["a0", "a1"]);
    });

    it("preserves the given order across the array", () => {
      const first = API.createElement({
        type: "rectangle",
        id: "first",
        index: null,
      });
      const second = API.createElement({
        type: "rectangle",
        id: "second",
        index: null,
      });
      const third = API.createElement({
        type: "rectangle",
        id: "third",
        index: null,
      });

      const fixed = repairBindings([first, second, third], REPAIR_ALL);

      expect(fixed.map((el) => el.id)).toEqual(["first", "second", "third"]);
    });
  });

  describe("locking", () => {
    it("repairs a locked arrow's broken binding", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        locked: true,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.elementId).toBe("rect");
    });

    it("keeps an existing binding to a locked target", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        locked: true,
        boundElements: [{ id: "arrow", type: "arrow" }],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;
      const fixedRect = fixed.find((el) => el.id === "rect")!;

      expect(fixedArrow.startBinding?.elementId).toBe("rect");
      expect(fixedRect.boundElements).toEqual([{ id: "arrow", type: "arrow" }]);
    });

    it("does not infer a new binding onto a locked target", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        locked: true,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: null,
        endBinding: null,
      });

      const fixed = repairBindings([rect, arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding).toBeNull();
    });
  });

  describe("bound text and containers", () => {
    it("keeps container-bound text intact", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: [{ id: "text", type: "text" }],
      });
      const text = API.createElement({
        type: "text",
        id: "text",
        x: 10,
        y: 10,
        width: 80,
        height: 20,
        text: "hi",
        containerId: "rect",
      });

      const fixed = repairBindings([rect, text], REPAIR_ALL);
      const fixedRect = fixed.find((el) => el.id === "rect")!;
      const fixedText = fixed.find((el) => el.id === "text")!;

      expect(fixedRect.boundElements).toEqual([{ id: "text", type: "text" }]);
      expect((fixedText as any).containerId).toBe("rect");
    });
  });

  describe("elbow arrows", () => {
    const elbowRect = () =>
      API.createElement({
        type: "rectangle",
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        boundElements: null,
      });

    it("normalizes a hallucinated diagonal route to an orthogonal one", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        elbowed: true,
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 40)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      const fixed = repairBindings([elbowRect(), arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawElbowArrowElement;

      // an elbow route is axis-aligned: every non-adjacent pair of segments is
      // perpendicular, which a diagonal segment would violate
      for (let i = 1; i < fixedArrow.points.length - 1; i++) {
        const [ax, ay] = fixedArrow.points[i];
        const [bx, by] = fixedArrow.points[i - 1];
        const [cx, cy] = fixedArrow.points[i + 1];
        const orthogonal = (ax === bx || ay === by) && (ax === cx || ay === cy);
        expect(orthogonal).toBe(true);
      }
    });

    it("drops malformed fixedSegments without throwing", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        elbowed: true,
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0), pointFrom(100, 40)],
        fixedSegments: [
          { start: pointFrom(0, 0), end: pointFrom(10, 10), index: 99 },
          { start: pointFrom(5, 5), end: pointFrom(999, 999), index: -3 },
        ],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: null,
      });

      expect(() =>
        repairBindings([elbowRect(), arrow], REPAIR_ALL),
      ).not.toThrow();

      const fixed = repairBindings([elbowRect(), arrow], REPAIR_ALL);
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawElbowArrowElement;

      expect(fixedArrow.points.length).toBeGreaterThanOrEqual(2);
    });

    it("forces the binding mode to orbit, like every other elbow writer", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        elbowed: true,
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "inside",
        },
        endBinding: null,
      });

      const fixed = repairBindings([elbowRect(), arrow], {
        ...REPAIR_ALL,
        actions: ["reanchorBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawElbowArrowElement;

      expect(fixedArrow.startBinding?.mode).toBe("orbit");
    });

    it("keeps a non-elbow arrow's inside mode", () => {
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom(0, 0), pointFrom(50, 0)],
        startBinding: {
          elementId: "rect",
          fixedPoint: [0.5, 0.5],
          mode: "inside",
        },
        endBinding: null,
      });

      const fixed = repairBindings([elbowRect(), arrow], {
        ...REPAIR_ALL,
        actions: ["reanchorBindings"],
      });
      const fixedArrow = fixed.find(
        (el) => el.id === "arrow",
      ) as ExcalidrawArrowElement;

      expect(fixedArrow.startBinding?.mode).toBe("inside");
    });
  });
});

describe("repairBindings types", () => {
  it("accepts a typed bindable array", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
    }) as ExcalidrawBindableElement;

    const fixed: readonly ExcalidrawElement[] = repairBindings([rect], {
      actions: ["pruneBoundElements"],
    });

    expect(fixed).toHaveLength(1);
  });
});
