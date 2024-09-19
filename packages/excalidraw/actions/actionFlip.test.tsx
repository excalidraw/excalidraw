import React from "react";
import { Excalidraw } from "../index";
import { render } from "../tests/test-utils";
import { API } from "../tests/helpers/api";
import { point } from "../../math";
import { actionFlipHorizontal, actionFlipVertical } from "./actionFlip";

const { h } = window;

const testElements = [
  API.createElement({
    type: "rectangle",
    id: "rec1",
    x: 1046,
    y: 541,
    width: 100,
    height: 100,
    boundElements: [
      {
        id: "arr",
        type: "arrow",
      },
    ],
  }),
  API.createElement({
    type: "rectangle",
    id: "rec2",
    x: 1169,
    y: 777,
    width: 102,
    height: 115,
    boundElements: [
      {
        id: "arr",
        type: "arrow",
      },
    ],
  }),
  API.createElement({
    type: "arrow",
    id: "arrow",
    x: 1103.0717787616313,
    y: 536.8531862198708,
    width: 159.68539325842903,
    height: 333.0396003698186,
    startBinding: {
      elementId: "rec1",
      focus: 0.1366906474820229,
      gap: 5.000000000000057,
      fixedPoint: [0.5683453237410123, -0.05014327585315258],
    },
    endBinding: {
      elementId: "rec2",
      focus: 0.0014925373134265828,
      gap: 5,
      fixedPoint: [-0.04862325174825108, 0.4992537313432874],
    },
    points: [
      point(0, 0),
      point(0, -35),
      point(-97.80898876404626, -35),
      point(-97.80898876404626, 298.0396003698186),
      point(61.87640449438277, 298.0396003698186),
    ],
    elbowed: true,
  }),
];

describe("flipping action", () => {
  it("flip re-centers the selection even after multiple flip actions", async () => {
    await render(<Excalidraw initialData={{ elements: testElements }} />);

    API.setSelectedElements(testElements);

    expect(Object.keys(h.state.selectedElementIds).length).toBe(3);

    API.executeAction(actionFlipHorizontal);
    API.executeAction(actionFlipHorizontal);
    API.executeAction(actionFlipHorizontal);

    const rec1 = h.elements.find((el) => el.id === "rec1");
    expect(rec1?.x).toBeCloseTo(1113.78, 0);
    expect(rec1?.y).toBeCloseTo(541, 0);

    const rec2 = h.elements.find((el) => el.id === "rec2");
    expect(rec2?.x).toBeCloseTo(988.72, 0);
    expect(rec2?.y).toBeCloseTo(777, 0);
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
