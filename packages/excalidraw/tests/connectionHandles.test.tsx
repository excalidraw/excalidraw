import React from "react";

import { reseed } from "@excalidraw/common";
import {
  CONNECTION_HANDLE_OFFSET,
  getConnectionHandles,
  getFixedPointForSide,
  hitTestConnectionHandles,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const mouse = new Pointer("mouse");

const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  await render(<Excalidraw handleKeyboardGlobally />);
  act(() => {
    // the default zoom of 1 keeps scene units and screen px interchangeable,
    // which every position in these tests relies on
    h.setState({ zoom: { value: 1 as any } });
  });
});

const elementsMap = () => h.app.scene.getNonDeletedElementsMap();

/** A 100x100 rectangle whose top-left is at (x, y). */
const createRect = (x: number, y: number) => {
  const rect = API.createElement({
    type: "rectangle",
    x,
    y,
    width: 100,
    height: 100,
  }) as NonDeleted<ExcalidrawBindableElement>;
  return rect;
};

const handlePoint = (
  element: NonDeleted<ExcalidrawBindableElement>,
  side: "top" | "right" | "bottom" | "left",
) =>
  getConnectionHandles(element, elementsMap(), 1).find((h) => h.side === side)!
    .point;

describe("connection handles — geometry and hit-testing", () => {
  it("places the four handles just outside the side midpoints", () => {
    const rect = createRect(0, 0);
    API.setElements([rect]);

    const handles = getConnectionHandles(rect, elementsMap(), 1);

    expect(handles).toHaveLength(4);

    const bySide = Object.fromEntries(
      handles.map((handle) => [handle.side, handle.point]),
    );

    expect(bySide.top).toEqual([50, -CONNECTION_HANDLE_OFFSET]);
    expect(bySide.bottom).toEqual([50, 100 + CONNECTION_HANDLE_OFFSET]);
    expect(bySide.left).toEqual([-CONNECTION_HANDLE_OFFSET, 50]);
    expect(bySide.right).toEqual([100 + CONNECTION_HANDLE_OFFSET, 50]);
  });

  it("keeps the on-screen offset constant as zoom changes", () => {
    const rect = createRect(0, 0);
    API.setElements([rect]);

    const atDoubleZoom = getConnectionHandles(rect, elementsMap(), 2);
    const top = atDoubleZoom.find((handle) => handle.side === "top")!.point;

    // at 2x zoom the scene-space gap halves, so the on-screen gap is unchanged
    expect(top).toEqual([50, -CONNECTION_HANDLE_OFFSET / 2]);
  });

  it("hit-tests a handle and misses the shape body and empty space", () => {
    const rect = createRect(0, 0);
    API.setElements([rect]);

    const right = handlePoint(rect, "right");

    expect(hitTestConnectionHandles(right, rect, elementsMap(), 1)).toBe(
      "right",
    );

    // dead centre of the shape is the body, not a handle
    expect(
      hitTestConnectionHandles(
        pointFrom<GlobalPoint>(50, 50),
        rect,
        elementsMap(),
        1,
      ),
    ).toBe(null);

    // far outside
    expect(
      hitTestConnectionHandles(
        pointFrom<GlobalPoint>(500, 500),
        rect,
        elementsMap(),
        1,
      ),
    ).toBe(null);
  });

  it("maps each side to the binding ratio that pins it there", () => {
    expect(getFixedPointForSide("top")).toEqual([0.5, 0]);
    expect(getFixedPointForSide("right")).toEqual([1, 0.5]);
    expect(getFixedPointForSide("bottom")).toEqual([0.5, 1]);
    expect(getFixedPointForSide("left")).toEqual([0, 0.5]);
  });
});

describe("connection handles — creating an arrow", () => {
  it("creates an arrow bound to the source side when dragged from a handle", () => {
    const rect = createRect(0, 0);
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    const right = handlePoint(rect, "right");

    // hover so the handles are showing, then drag one out into empty space
    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    mouse.moveTo(300, 50);
    mouse.upAt(300, 50);

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;

    expect(arrow).toBeDefined();
    expect(arrow.isDeleted).toBe(false);
    expect(arrow.startBinding?.elementId).toBe(rect.id);

    // the ratio pins the right edge's midpoint. The binding system re-derives
    // it from the arrow's actual start point as the drag proceeds, so the
    // cross-axis value lands a hair off the exact midpoint — what matters is
    // that it stays on the right edge (x === 1) at mid-height.
    const [ratioX, ratioY] = arrow.startBinding!.fixedPoint;
    expect(ratioX).toBe(getFixedPointForSide("right")[0]);
    expect(ratioY).toBeCloseTo(getFixedPointForSide("right")[1], 2);

    // released over empty space, so the end stays free
    expect(arrow.endBinding).toBe(null);
  });

  it("uses the last-used arrow style", () => {
    const rect = createRect(0, 0);
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    act(() => {
      h.setState({
        currentItemStrokeColor: "#e03131",
        currentItemStrokeStyle: "dashed",
        currentItemEndArrowhead: "triangle",
      });
    });

    const right = handlePoint(rect, "right");
    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    mouse.moveTo(300, 50);
    mouse.upAt(300, 50);

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;

    expect(arrow.strokeColor).toBe("#e03131");
    expect(arrow.strokeStyle).toBe("dashed");
    expect(arrow.endArrowhead).toBe("triangle");
  });

  it("discards the arrow when the handle is pressed without dragging", () => {
    const rect = createRect(0, 0);
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    const right = handlePoint(rect, "right");

    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    mouse.upAt(right[0], right[1]);

    const liveArrows = h.elements.filter(
      (element) => element.type === "arrow" && !element.isDeleted,
    );

    expect(liveArrows).toHaveLength(0);
  });
});

describe("connection handles — snapping to a target", () => {
  it("snaps the end to the target's nearest handle and binds there", () => {
    const source = createRect(0, 0);
    const target = createRect(300, 0);
    API.setElements([source, target]);
    API.setSelectedElements([source]);

    const right = handlePoint(source, "right");

    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    // drop just inside the target's left edge — nearest handle is "left"
    mouse.moveTo(310, 50);
    mouse.upAt(310, 50);

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;

    expect(arrow.startBinding?.elementId).toBe(source.id);
    expect(arrow.endBinding?.elementId).toBe(target.id);

    // snapped to the target's left side: x === 0, at mid-height (see the note
    // on ratio drift in the creation test above)
    const [ratioX, ratioY] = arrow.endBinding!.fixedPoint;
    expect(ratioX).toBe(getFixedPointForSide("left")[0]);
    expect(ratioY).toBeCloseTo(getFixedPointForSide("left")[1], 2);
  });

  it("does not bind the end back to the source shape", () => {
    const source = createRect(0, 0);
    API.setElements([source]);
    API.setSelectedElements([source]);

    const right = handlePoint(source, "right");

    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    // drag back over the source itself
    mouse.moveTo(50, 50);
    mouse.upAt(50, 50);

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;

    expect(arrow.endBinding).toBe(null);
  });
});

describe("connection handles — the arrow stays attached", () => {
  it("follows both shapes when they move", () => {
    const source = createRect(0, 0);
    const target = createRect(300, 0);
    API.setElements([source, target]);
    API.setSelectedElements([source]);

    const right = handlePoint(source, "right");
    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    mouse.moveTo(310, 50);
    mouse.upAt(310, 50);

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;

    expect(arrow.startBinding?.elementId).toBe(source.id);
    expect(arrow.endBinding?.elementId).toBe(target.id);

    const before = {
      end: [...arrow.points[arrow.points.length - 1]],
      x: arrow.x,
      y: arrow.y,
    };

    // drag the target shape 200px down by its body
    mouse.reset();
    act(() => {
      h.setState({ selectedElementIds: { [target.id]: true } });
    });
    mouse.downAt(350, 50);
    mouse.moveTo(350, 150);
    mouse.moveTo(350, 250);
    mouse.upAt(350, 250);

    expect(h.elements.find((el) => el.id === target.id)!.y).toBeGreaterThan(
      100,
    );

    const movedArrow = h.elements.find(
      (element) => element.id === arrow.id,
    ) as ExcalidrawArrowElement;

    // still bound to both ends ...
    expect(movedArrow.startBinding?.elementId).toBe(source.id);
    expect(movedArrow.endBinding?.elementId).toBe(target.id);

    // ... and the geometry followed the shape rather than staying put
    const after = {
      end: [...movedArrow.points[movedArrow.points.length - 1]],
      x: movedArrow.x,
      y: movedArrow.y,
    };

    expect(after.end[1] !== before.end[1] || after.y !== before.y).toBe(true);
  });

  it("keeps the binding ratio when the target is resized", () => {
    const source = createRect(0, 0);
    const target = createRect(300, 0);
    API.setElements([source, target]);
    API.setSelectedElements([source]);

    const right = handlePoint(source, "right");
    mouse.moveTo(right[0], right[1]);
    mouse.downAt(right[0], right[1]);
    mouse.moveTo(310, 50);
    mouse.upAt(310, 50);

    const arrow = h.elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;

    const ratio = arrow.endBinding?.fixedPoint;

    act(() => {
      h.app.scene.mutateElement(
        h.elements.find((el) => el.id === target.id) as any,
        { width: 200, height: 200 },
      );
    });

    const resizedArrow = h.elements.find(
      (element) => element.id === arrow.id,
    ) as ExcalidrawArrowElement;

    // the ratio is what survives a resize — that is the point of binding to a
    // fixed point rather than to an absolute position
    expect(resizedArrow.endBinding?.fixedPoint).toEqual(ratio);
    expect(resizedArrow.endBinding?.elementId).toBe(target.id);
  });
});
