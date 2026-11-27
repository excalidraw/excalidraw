import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElbowArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionReverseArrow, reverseArrow } from "./actionReverseArrow";

const { h } = window;

/** an element's points in scene coordinates */
const globalPoints = (el: {
  x: number;
  y: number;
  points: readonly LocalPoint[];
}) => el.points.map((p) => [el.x + p[0], el.y + p[1]]);

describe("reverse arrow direction", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("keeps the line in place and points it the other way", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 10,
      y: 20,
      points: [pointFrom(0, 0), pointFrom(50, 30), pointFrom(100, 0)],
      startArrowhead: null,
      endArrowhead: "triangle",
    });
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    API.executeAction(actionReverseArrow);

    const reversed = API.getElement(arrow);
    expect(reversed.x).toBe(110);
    expect(reversed.y).toBe(20);
    expect(reversed.points[0]).toEqual(pointFrom(0, 0));
    expect(globalPoints(reversed)).toEqual([...globalPoints(arrow)].reverse());
    expect(reversed.startArrowhead).toBe("triangle");
    expect(reversed.endArrowhead).toBe(null);
  });

  it("swaps the bindings with the ends", () => {
    const a = API.createElement({
      type: "rectangle",
      id: "a",
      x: 0,
      y: 0,
      boundElements: [{ type: "arrow", id: "arrow1" }],
    });
    const b = API.createElement({
      type: "rectangle",
      id: "b",
      x: 300,
      y: 0,
      boundElements: [{ type: "arrow", id: "arrow1" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow1",
      x: 100,
      y: 50,
      points: [pointFrom(0, 0), pointFrom(200, 0)],
      startBinding: { elementId: "a", fixedPoint: [1, 0.5], mode: "orbit" },
      endBinding: { elementId: "b", fixedPoint: [0, 0.5], mode: "orbit" },
    });
    API.setElements([a, b, arrow]);
    API.setSelectedElements([arrow]);

    API.executeAction(actionReverseArrow);

    const reversed = API.getElement(arrow);
    expect(reversed.startBinding?.elementId).toBe("b");
    expect(reversed.startBinding?.fixedPoint).toEqual([0, 0.5]);
    expect(reversed.endBinding?.elementId).toBe("a");
    expect(reversed.endBinding?.fixedPoint).toEqual([1, 0.5]);
  });

  it("reversing twice gives back the original arrow", () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 5,
      y: 5,
      points: [pointFrom(0, 0), pointFrom(40, 60), pointFrom(90, 10)],
      startArrowhead: "circle",
      endArrowhead: "arrow",
    });
    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    API.executeAction(actionReverseArrow);
    API.executeAction(actionReverseArrow);

    const back = API.getElement(arrow);
    expect(back.x).toBe(arrow.x);
    expect(back.y).toBe(arrow.y);
    expect(back.points).toEqual(arrow.points);
    expect(back.startArrowhead).toBe("circle");
    expect(back.endArrowhead).toBe("arrow");
  });

  it("moves an elbow arrow's fixed segments with the points", () => {
    const elbow = {
      ...API.createElement({
        type: "arrow",
        elbowed: true,
        x: 0,
        y: 0,
        points: [
          pointFrom(0, 0),
          pointFrom(50, 0),
          pointFrom(50, 100),
          pointFrom(120, 100),
        ],
      }),
      fixedSegments: [
        { index: 2, start: pointFrom(50, 0), end: pointFrom(50, 100) },
      ],
    } as unknown as ExcalidrawElbowArrowElement;

    const reversed = reverseArrow(elbow);

    expect(reversed.x).toBe(120);
    expect(reversed.y).toBe(100);
    // the middle segment is still the middle one, now running the other way
    expect(reversed.fixedSegments).toEqual([
      { index: 2, start: pointFrom(-70, 0), end: pointFrom(-70, -100) },
    ]);
  });

  it("leaves lines and other shapes alone", () => {
    const line = API.createElement({
      type: "line",
      points: [pointFrom(0, 0), pointFrom(100, 0)],
    });
    const rect = API.createElement({ type: "rectangle" });
    API.setElements([line, rect]);
    API.setSelectedElements([line, rect]);

    expect(h.app.actionManager.isActionEnabled(actionReverseArrow)).toBe(false);
    expect(API.getElement(line)).toEqual(line);
  });
});
