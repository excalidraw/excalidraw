import React from "react";
import { Excalidraw } from "../index";
import { render } from "../tests/test-utils";
import { API } from "../tests/helpers/api";
import { pointFrom } from "../../math";
import { actionFlipHorizontal, actionFlipVertical } from "./actionFlip";

const { h } = window;

describe("flipping re-centers selection", () => {
  it("elbow arrow touches group selection side yet it remains in place after multiple moves", async () => {
    const elements = [
      API.createElement({
        type: "rectangle",
        id: "rec1",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        boundElements: [{ id: "arr", type: "arrow" }],
      }),
      API.createElement({
        type: "rectangle",
        id: "rec2",
        x: 220,
        y: 250,
        width: 100,
        height: 100,
        boundElements: [{ id: "arr", type: "arrow" }],
      }),
      API.createElement({
        type: "arrow",
        id: "arr",
        x: 149.9,
        y: 95,
        width: 156,
        height: 239.9,
        startBinding: {
          elementId: "rec1",
          focus: 0,
          gap: 5,
          fixedPoint: [0.49, -0.05],
        },
        endBinding: {
          elementId: "rec2",
          focus: 0,
          gap: 5,
          fixedPoint: [-0.05, 0.49],
        },
        startArrowhead: null,
        endArrowhead: "arrow",
        fixedSegments: null,
        points: [
          pointFrom(0, 0),
          pointFrom(0, -35),
          pointFrom(-90, -35),
          pointFrom(-90, 204),
          pointFrom(66, 204),
        ],
        elbowed: true,
      }),
    ];
    await render(<Excalidraw initialData={{ elements }} />);

    API.setSelectedElements(elements);

    expect(Object.keys(h.state.selectedElementIds).length).toBe(3);

    API.executeAction(actionFlipHorizontal);
    API.executeAction(actionFlipHorizontal);
    API.executeAction(actionFlipHorizontal);
    API.executeAction(actionFlipHorizontal);

    const rec1 = h.elements.find((el) => el.id === "rec1")!;
    expect(rec1.x).toBeCloseTo(100, 0);
    expect(rec1.y).toBeCloseTo(100, 0);

    const rec2 = h.elements.find((el) => el.id === "rec2")!;
    expect(rec2.x).toBeCloseTo(220, 0);
    expect(rec2.y).toBeCloseTo(250, 0);
  });
});

describe("flipping arrowheads", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("flipping bound arrow should flip arrowheads only", () => {
    const rect = API.createElement({
      type: "rectangle",
      boundElements: [{ type: "arrow", id: "arrow1" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow1",
      startArrowhead: "arrow",
      endArrowhead: null,
      endBinding: {
        elementId: rect.id,
        focus: 0.5,
        gap: 5,
      },
    });

    API.setElements([rect, arrow]);
    API.setSelectedElements([arrow]);

    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe(null);

    API.executeAction(actionFlipHorizontal);
    expect(API.getElement(arrow).startArrowhead).toBe(null);
    expect(API.getElement(arrow).endArrowhead).toBe("arrow");

    API.executeAction(actionFlipHorizontal);
    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe(null);

    API.executeAction(actionFlipVertical);
    expect(API.getElement(arrow).startArrowhead).toBe(null);
    expect(API.getElement(arrow).endArrowhead).toBe("arrow");
  });

  it("flipping bound arrow should flip arrowheads only 2", () => {
    const rect = API.createElement({
      type: "rectangle",
      boundElements: [{ type: "arrow", id: "arrow1" }],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      boundElements: [{ type: "arrow", id: "arrow1" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow1",
      startArrowhead: "arrow",
      endArrowhead: "circle",
      startBinding: {
        elementId: rect.id,
        focus: 0.5,
        gap: 5,
      },
      endBinding: {
        elementId: rect2.id,
        focus: 0.5,
        gap: 5,
      },
    });

    API.setElements([rect, rect2, arrow]);
    API.setSelectedElements([arrow]);

    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe("circle");

    API.executeAction(actionFlipHorizontal);
    expect(API.getElement(arrow).startArrowhead).toBe("circle");
    expect(API.getElement(arrow).endArrowhead).toBe("arrow");

    API.executeAction(actionFlipVertical);
    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe("circle");
  });

  it("flipping unbound arrow shouldn't flip arrowheads", () => {
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow1",
      startArrowhead: "arrow",
      endArrowhead: "circle",
    });

    API.setElements([arrow]);
    API.setSelectedElements([arrow]);

    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe("circle");

    API.executeAction(actionFlipHorizontal);
    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe("circle");
  });

  it("flipping bound arrow shouldn't flip arrowheads if selected alongside non-arrow eleemnt", () => {
    const rect = API.createElement({
      type: "rectangle",
      boundElements: [{ type: "arrow", id: "arrow1" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow1",
      startArrowhead: "arrow",
      endArrowhead: null,
      endBinding: {
        elementId: rect.id,
        focus: 0.5,
        gap: 5,
      },
    });

    API.setElements([rect, arrow]);
    API.setSelectedElements([rect, arrow]);

    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe(null);

    API.executeAction(actionFlipHorizontal);
    expect(API.getElement(arrow).startArrowhead).toBe("arrow");
    expect(API.getElement(arrow).endArrowhead).toBe(null);
  });
});
