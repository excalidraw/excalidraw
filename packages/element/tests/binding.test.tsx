import { KEYS, arrayToMap } from "@excalidraw/common";

import { pointFrom } from "@excalidraw/math";

import { actionWrapTextInContainer } from "@excalidraw/excalidraw/actions/actionBoundText";

import { Excalidraw, isLinearElement } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Pointer, Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";

import { defaultLang, setLanguage } from "@excalidraw/excalidraw/i18n";

import { getTransformHandles } from "../src/transformHandles";
import {
  getTextEditor,
  TEXT_EDITOR_SELECTOR,
} from "../../excalidraw/tests/queries/dom";

import type { ExcalidrawLinearElement, FixedPointBinding } from "../src/types";

const { h } = window;

const mouse = new Pointer("mouse");

describe("element binding", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should create valid binding if duplicate start/end points", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 0,
      width: 100,
      height: 1,
      points: [
        pointFrom(0, 0),
        pointFrom(0, 0),
        pointFrom(100, 0),
        pointFrom(100, 0),
      ],
    });
    API.setElements([rect, arrow]);
    expect(arrow.startBinding).toBe(null);

    // select arrow
    mouse.clickAt(150, 0);

    // move arrow start to potential binding position
    mouse.downAt(100, 0);
    mouse.moveTo(55, 0);
    mouse.up(0, 0);

    // Point selection is evaluated like the points are rendered,
    // from right to left. So clicking on the first point should move the joint,
    // not the start point.
    expect(arrow.startBinding).toBe(null);

    // Now that the start point is free, move it into overlapping position
    mouse.downAt(100, 0);
    mouse.moveTo(55, 0);
    mouse.up(0, 0);

    expect(API.getSelectedElements()).toEqual([arrow]);

    expect(arrow.startBinding).toEqual({
      elementId: rect.id,
      focus: 0,
      gap: 0,
      fixedPoint: expect.arrayContaining([1.1, 0]),
    });

    // Move the end point to the overlapping binding position
    mouse.downAt(200, 0);
    mouse.moveTo(55, 0);
    mouse.up(0, 0);

    // Both the start and the end points should be bound
    expect(arrow.startBinding).toEqual({
      elementId: rect.id,
      focus: 0,
      gap: 0,
      fixedPoint: expect.arrayContaining([1.1, 0]),
    });
    expect(arrow.endBinding).toEqual({
      elementId: rect.id,
      focus: 0,
      gap: 0,
      fixedPoint: expect.arrayContaining([1.1, 0]),
    });
  });

  //@TODO fix the test with rotation
  it.skip("rotation of arrow should rebind both ends", () => {
    const rectLeft = UI.createElement("rectangle", {
      x: 0,
      width: 200,
      height: 500,
    });
    const rectRight = UI.createElement("rectangle", {
      x: 400,
      width: 200,
      height: 500,
    });
    const arrow = UI.createElement("arrow", {
      x: 210,
      y: 250,
      width: 180,
      height: 1,
    });
    expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
    expect(arrow.endBinding?.elementId).toBe(rectRight.id);

    const rotation = getTransformHandles(
      arrow,
      h.state.zoom,
      arrayToMap(h.elements),
      "mouse",
    ).rotation!;
    const rotationHandleX = rotation[0] + rotation[2] / 2;
    const rotationHandleY = rotation[1] + rotation[3] / 2;
    mouse.down(rotationHandleX, rotationHandleY);
    mouse.move(300, 400);
    mouse.up();
    expect(arrow.angle).toBeGreaterThan(0.7 * Math.PI);
    expect(arrow.angle).toBeLessThan(1.3 * Math.PI);
    expect(arrow.startBinding?.elementId).toBe(rectRight.id);
    expect(arrow.endBinding?.elementId).toBe(rectLeft.id);
  });

  // TODO fix & reenable once we rewrite tests to work with concurrency
  it.skip(
    "editing arrow and moving its head to bind it to element A, finalizing the" +
      "editing by clicking on element A should end up selecting A",
    async () => {
      UI.createElement("rectangle", {
        y: 0,
        size: 100,
      });
      // Create arrow bound to rectangle
      UI.clickTool("arrow");
      mouse.down(50, -100);
      mouse.up(0, 80);

      // Edit arrow with multi-point
      mouse.doubleClick();
      // move arrow head
      mouse.down();
      mouse.up(0, 10);
      expect(API.getSelectedElement().type).toBe("arrow");

      // NOTE this mouse down/up + await needs to be done in order to repro
      // the issue, due to https://github.com/excalidraw/excalidraw/blob/46bff3daceb602accf60c40a84610797260fca94/src/components/App.tsx#L740
      mouse.reset();
      expect(h.state.editingLinearElement).not.toBe(null);
      mouse.down(0, 0);
      await new Promise((r) => setTimeout(r, 100));
      expect(h.state.editingLinearElement).toBe(null);
      expect(API.getSelectedElement().type).toBe("rectangle");
      mouse.up();
      expect(API.getSelectedElement().type).toBe("rectangle");
    },
  );

  it("should unbind arrow when moving it with keyboard", () => {
    const rectangle = UI.createElement("rectangle", {
      x: 75,
      y: 0,
      size: 100,
    });

    // Creates arrow 1px away from bidding with rectangle
    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 49,
    });

    expect(arrow.endBinding).toBe(null);

    mouse.downAt(49, 49);
    mouse.moveTo(51, 0);
    mouse.up(0, 0);

    // Test sticky connection
    expect(API.getSelectedElement().type).toBe("arrow");
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(arrow.endBinding?.elementId).toBe(rectangle.id);
    Keyboard.keyPress(KEYS.ARROW_LEFT);
    expect(arrow.endBinding?.elementId).toBe(rectangle.id);

    // Sever connection
    expect(API.getSelectedElement().type).toBe("arrow");
    Keyboard.keyPress(KEYS.ARROW_LEFT);
    expect(arrow.endBinding).not.toBe(null);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(arrow.endBinding).not.toBe(null);
  });

  it("should unbind on bound element deletion", () => {
    const rectangle = UI.createElement("rectangle", {
      x: 60,
      y: 0,
      size: 100,
    });

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding?.elementId).toBe(rectangle.id);

    mouse.select(rectangle);
    expect(API.getSelectedElement().type).toBe("rectangle");
    Keyboard.keyDown(KEYS.DELETE);
    expect(arrow.endBinding).toBe(null);
  });

  it("should unbind on text element deletion by submitting empty text", async () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
    });

    API.setElements([text]);

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding?.elementId).toBe(text.id);

    // edit text element and submit
    // -------------------------------------------------------------------------

    UI.clickTool("text");

    mouse.clickAt(text.x + 50, text.y + 50);

    const editor = await getTextEditor();

    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: KEYS.ESCAPE });

    expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    expect(arrow.endBinding).toBe(null);
  });

  it("should keep binding on text update", async () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
    });

    API.setElements([text]);

    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding?.elementId).toBe(text.id);

    // delete text element by submitting empty text
    // -------------------------------------------------------------------------

    UI.clickTool("text");

    mouse.clickAt(text.x + 50, text.y + 50);
    const editor = await getTextEditor();

    expect(editor).not.toBe(null);

    fireEvent.change(editor, { target: { value: "asdasdasdasdas" } });
    fireEvent.keyDown(editor, { key: KEYS.ESCAPE });

    expect(document.querySelector(TEXT_EDITOR_SELECTOR)).toBe(null);
    expect(arrow.endBinding?.elementId).toBe(text.id);
  });

  it("should update binding when text containerized", async () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      id: "rectangle1",
      width: 100,
      height: 100,
      boundElements: [
        { id: "arrow1", type: "arrow" },
        { id: "arrow2", type: "arrow" },
      ],
    });

    const arrow1 = API.createElement({
      type: "arrow",
      id: "arrow1",
      points: [pointFrom(0, 0), pointFrom(0, -87.45777932247563)],
      startBinding: {
        elementId: "rectangle1",
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
      endBinding: {
        elementId: "text1",
        focus: 0.2,
        gap: 7,
        fixedPoint: [1, 0.5],
      },
    });

    const arrow2 = API.createElement({
      type: "arrow",
      id: "arrow2",
      points: [pointFrom(0, 0), pointFrom(0, -87.45777932247563)],
      startBinding: {
        elementId: "text1",
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
      endBinding: {
        elementId: "rectangle1",
        focus: 0.2,
        gap: 7,
        fixedPoint: [1, 0.5],
      },
    });

    const text1 = API.createElement({
      type: "text",
      id: "text1",
      text: "ola",
      boundElements: [
        { id: "arrow1", type: "arrow" },
        { id: "arrow2", type: "arrow" },
      ],
    });

    API.setElements([rectangle1, arrow1, arrow2, text1]);

    API.setSelectedElements([text1]);

    expect(h.state.selectedElementIds[text1.id]).toBe(true);

    API.executeAction(actionWrapTextInContainer);

    // new text container will be placed before the text element
    const container = h.elements.at(-2)!;

    expect(container.type).toBe("rectangle");
    expect(container.id).not.toBe(rectangle1.id);

    expect(container).toEqual(
      expect.objectContaining({
        boundElements: expect.arrayContaining([
          {
            type: "text",
            id: text1.id,
          },
          {
            type: "arrow",
            id: arrow1.id,
          },
          {
            type: "arrow",
            id: arrow2.id,
          },
        ]),
      }),
    );

    expect(arrow1.startBinding?.elementId).toBe(rectangle1.id);
    expect(arrow1.endBinding?.elementId).toBe(container.id);
    expect(arrow2.startBinding?.elementId).toBe(container.id);
    expect(arrow2.endBinding?.elementId).toBe(rectangle1.id);
  });

  // #6459
  it("should unbind arrow only from the latest element", () => {
    const rectLeft = UI.createElement("rectangle", {
      x: 0,
      width: 200,
      height: 500,
    });
    const rectRight = UI.createElement("rectangle", {
      x: 400,
      width: 200,
      height: 500,
    });
    const arrow = UI.createElement("arrow", {
      x: 210,
      y: 250,
      width: 180,
      height: 1,
    });
    expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
    expect(arrow.endBinding?.elementId).toBe(rectRight.id);

    // Drag arrow off of bound rectangle range
    const handles = getTransformHandles(
      arrow,
      h.state.zoom,
      arrayToMap(h.elements),
      "mouse",
    ).se!;

    Keyboard.keyDown(KEYS.CTRL_OR_CMD);
    const elX = handles[0] + handles[2] / 2;
    const elY = handles[1] + handles[3] / 2;
    mouse.downAt(elX, elY);
    mouse.moveTo(300, 400);
    mouse.up();

    expect(arrow.startBinding).not.toBe(null);
    expect(arrow.endBinding).toBe(null);
  });

  it("should not unbind when duplicating via selection group", () => {
    const rectLeft = UI.createElement("rectangle", {
      x: 0,
      width: 200,
      height: 500,
    });
    const rectRight = UI.createElement("rectangle", {
      x: 400,
      y: 200,
      width: 200,
      height: 500,
    });
    const arrow = UI.createElement("arrow", {
      x: 210,
      y: 250,
      width: 177,
      height: 1,
    });
    expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
    expect(arrow.endBinding?.elementId).toBe(rectRight.id);

    mouse.downAt(-100, -100);
    mouse.moveTo(650, 750);
    mouse.up(0, 0);

    expect(API.getSelectedElements().length).toBe(3);

    mouse.moveTo(5, 5);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(5, 5);
      mouse.moveTo(1000, 1000);
      mouse.up(0, 0);

      expect(window.h.elements.length).toBe(6);
      window.h.elements.forEach((element) => {
        if (isLinearElement(element)) {
          expect(element.startBinding).not.toBe(null);
          expect(element.endBinding).not.toBe(null);
        } else {
          expect(element.boundElements).not.toBe(null);
        }
      });
    });
  });
});

describe("Fixed-point arrow binding", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should create fixed-point binding when both arrow endpoint is inside rectangle", () => {
    // Create a filled solid rectangle
    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 200);
    mouse.up();

    const rect = API.getSelectedElement();
    API.updateElement(rect, { fillStyle: "solid", backgroundColor: "#a5d8ff" });

    // Draw arrow with endpoint inside the filled rectangle, since only
    // filled bindables bind inside the shape
    UI.clickTool("arrow");
    mouse.downAt(110, 110);
    mouse.moveTo(160, 160);
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawLinearElement;
    expect(arrow.x).toBe(110);
    expect(arrow.y).toBe(110);

    // Should bind to the rectangle since endpoint is inside
    expect(arrow.startBinding?.elementId).toBe(rect.id);
    expect(arrow.endBinding?.elementId).toBe(rect.id);

    const startBinding = arrow.startBinding as FixedPointBinding;
    expect(startBinding.fixedPoint[0]).toBeGreaterThanOrEqual(0);
    expect(startBinding.fixedPoint[0]).toBeLessThanOrEqual(1);
    expect(startBinding.fixedPoint[1]).toBeGreaterThanOrEqual(0);
    expect(startBinding.fixedPoint[1]).toBeLessThanOrEqual(1);

    const endBinding = arrow.endBinding as FixedPointBinding;
    expect(endBinding.fixedPoint[0]).toBeGreaterThanOrEqual(0);
    expect(endBinding.fixedPoint[0]).toBeLessThanOrEqual(1);
    expect(endBinding.fixedPoint[1]).toBeGreaterThanOrEqual(0);
    expect(endBinding.fixedPoint[1]).toBeLessThanOrEqual(1);

    mouse.reset();

    // Move the bindable
    mouse.downAt(130, 110);
    mouse.moveTo(280, 110);
    mouse.up();

    // Check if the arrow moved
    expect(arrow.x).toBe(260);
    expect(arrow.y).toBe(110);
  });

  it("should create fixed-point binding when one of the arrow endpoint is inside rectangle", () => {
    // Create a filled solid rectangle
    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 200);
    mouse.up();

    const rect = API.getSelectedElement();
    API.updateElement(rect, { fillStyle: "solid", backgroundColor: "#a5d8ff" });

    // Draw arrow with endpoint inside the filled rectangle, since only
    // filled bindables bind inside the shape
    UI.clickTool("arrow");
    mouse.downAt(10, 10);
    mouse.moveTo(160, 160);
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawLinearElement;
    expect(arrow.x).toBe(10);
    expect(arrow.y).toBe(10);
    expect(arrow.width).toBe(150);
    expect(arrow.height).toBe(150);

    // Should bind to the rectangle since endpoint is inside
    expect(arrow.startBinding).toBe(null);
    expect(arrow.endBinding?.elementId).toBe(rect.id);

    const endBinding = arrow.endBinding as FixedPointBinding;
    expect(endBinding.fixedPoint[0]).toBeGreaterThanOrEqual(0);
    expect(endBinding.fixedPoint[0]).toBeLessThanOrEqual(1);
    expect(endBinding.fixedPoint[1]).toBeGreaterThanOrEqual(0);
    expect(endBinding.fixedPoint[1]).toBeLessThanOrEqual(1);

    mouse.reset();

    // Move the bindable
    mouse.downAt(130, 110);
    mouse.moveTo(280, 110);
    mouse.up();

    // Check if the arrow moved
    expect(arrow.x).toBe(10);
    expect(arrow.y).toBe(10);
    expect(arrow.width).toBe(300);
    expect(arrow.height).toBe(150);
  });

  it("should maintain relative position when arrow start point is dragged outside and rectangle is moved", () => {
    // Create a filled solid rectangle
    UI.clickTool("rectangle");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 200);
    mouse.up();

    const rect = API.getSelectedElement();
    API.updateElement(rect, { fillStyle: "solid", backgroundColor: "#a5d8ff" });

    // Draw arrow with both endpoints inside the filled rectangle, creating same-element binding
    UI.clickTool("arrow");
    mouse.downAt(120, 120);
    mouse.moveTo(180, 180);
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawLinearElement;

    // Both ends should be bound to the same rectangle
    expect(arrow.startBinding?.elementId).toBe(rect.id);
    expect(arrow.endBinding?.elementId).toBe(rect.id);

    mouse.reset();

    // Select the arrow and drag the start point outside the rectangle
    mouse.downAt(120, 120);
    mouse.moveTo(50, 50); // Move start point outside rectangle
    mouse.up();

    mouse.reset();

    // Move the rectangle by dragging it
    mouse.downAt(150, 110);
    mouse.moveTo(300, 300);
    mouse.up();

    // The end point should be a normal point binding
    const endBinding = arrow.endBinding as FixedPointBinding;
    expect(endBinding.focus).toBeCloseTo(0);
    expect(endBinding.gap).toBeCloseTo(0);

    expect(arrow.x).toBe(50);
    expect(arrow.y).toBe(50);
    expect(arrow.width).toBeCloseTo(280, 0);
    expect(arrow.height).toBeCloseTo(320, 0);
  });

  it("should move inner points when arrow is bound to same element on both ends", () => {
    // Create one rectangle as binding target
    const rect = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 200,
      height: 100,
      fillStyle: "solid",
      backgroundColor: "#a5d8ff",
    });

    // Create a non-elbowed arrow with inner points bound to the same element on both ends
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 75,
      width: 100,
      height: 50,
      points: [
        pointFrom(0, 0), // start point
        pointFrom(25, -25), // first inner point
        pointFrom(75, 25), // second inner point
        pointFrom(100, 0), // end point
      ],
      startBinding: {
        elementId: rect.id,
        focus: 0,
        gap: 0,
        fixedPoint: [0.25, 0.5],
      },
      endBinding: {
        elementId: rect.id,
        focus: 0,
        gap: 0,
        fixedPoint: [0.75, 0.5],
      },
    });

    API.setElements([rect, arrow]);

    // Store original inner point positions (local coordinates)
    const originalInnerPoint1 = [...arrow.points[1]];
    const originalInnerPoint2 = [...arrow.points[2]];

    // Move the rectangle
    mouse.reset();
    mouse.downAt(150, 100); // Click on the rectangle
    mouse.moveTo(300, 200); // Move it down and to the right
    mouse.up();

    // Verify that inner points moved with the arrow (same local coordinates)
    // When both ends are bound to the same element, inner points should maintain
    // their local coordinates relative to the arrow's origin
    expect(arrow.points[1][0]).toBe(originalInnerPoint1[0]);
    expect(arrow.points[1][1]).toBe(originalInnerPoint1[1]);
    expect(arrow.points[2][0]).toBe(originalInnerPoint2[0]);
    expect(arrow.points[2][1]).toBe(originalInnerPoint2[1]);
  });

  it("should NOT move inner points when arrow is bound to different elements", () => {
    // Create two rectangles as binding targets
    const rectLeft = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    const rectRight = API.createElement({
      type: "rectangle",
      x: 300,
      y: 0,
      width: 100,
      height: 100,
    });

    // Create a non-elbowed arrow with inner points bound to different elements
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 50,
      width: 200,
      height: 0,
      points: [
        pointFrom(0, 0), // start point
        pointFrom(50, -20), // first inner point
        pointFrom(150, 20), // second inner point
        pointFrom(200, 0), // end point
      ],
      startBinding: {
        elementId: rectLeft.id,
        focus: 0.5,
        gap: 5,
      },
      endBinding: {
        elementId: rectRight.id,
        focus: 0.5,
        gap: 5,
      },
    });

    API.setElements([rectLeft, rectRight, arrow]);

    // Store original inner point positions
    const originalInnerPoint1 = [...arrow.points[1]];
    const originalInnerPoint2 = [...arrow.points[2]];

    // Move the right rectangle down by 50 pixels
    mouse.reset();
    mouse.downAt(350, 50); // Click on the right rectangle
    mouse.moveTo(350, 100); // Move it down
    mouse.up();

    // Verify that inner points did NOT move when bound to different elements
    // The arrow should NOT translate inner points proportionally when only one end moves
    expect(arrow.points[1][0]).toBe(originalInnerPoint1[0]);
    expect(arrow.points[1][1]).toBe(originalInnerPoint1[1]);
    expect(arrow.points[2][0]).toBe(originalInnerPoint2[0]);
    expect(arrow.points[2][1]).toBe(originalInnerPoint2[1]);
  });
});

describe("line segment extension binding", () => {
  beforeEach(async () => {
    mouse.reset();

    await act(() => {
      return setLanguage(defaultLang);
    });
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should use point binding when extended segment intersects element", () => {
    // Create a rectangle that will be intersected by the extended arrow segment
    const rect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });

    API.setElements([rect]);

    // Draw an arrow that points at the rectangle (extended segment will intersect)
    UI.clickTool("arrow");
    mouse.downAt(0, 0); // Start point
    mouse.moveTo(120, 95); // End point - arrow direction points toward rectangle
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawLinearElement;

    // Should create a normal point binding since the extended line segment
    // from the last arrow segment intersects the rectangle
    expect(arrow.endBinding?.elementId).toBe(rect.id);
    expect(arrow.endBinding).toHaveProperty("focus");
    expect(arrow.endBinding).toHaveProperty("gap");
    expect(arrow.endBinding).not.toHaveProperty("fixedPoint");
  });

  it("should use fixed point binding when extended segment misses element", () => {
    // Create a rectangle positioned so the extended arrow segment will miss it
    const rect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });

    API.setElements([rect]);

    // Draw an arrow that doesn't point at the rectangle (extended segment will miss)
    UI.clickTool("arrow");
    mouse.reset();
    mouse.downAt(125, 93); // Start point
    mouse.moveTo(175, 93); // End point - arrow direction is horizontal, misses rectangle
    mouse.up();

    const arrow = API.getSelectedElement() as ExcalidrawLinearElement;

    // Should create a fixed point binding since the extended line segment
    // from the last arrow segment misses the rectangle
    expect(arrow.startBinding?.elementId).toBe(rect.id);
    expect(arrow.startBinding).toHaveProperty("fixedPoint");
    expect(
      (arrow.startBinding as FixedPointBinding).fixedPoint[0],
    ).toBeGreaterThanOrEqual(0);
    expect(
      (arrow.startBinding as FixedPointBinding).fixedPoint[0],
    ).toBeLessThanOrEqual(1);
    expect(
      (arrow.startBinding as FixedPointBinding).fixedPoint[1],
    ).toBeLessThanOrEqual(0);
    expect(
      (arrow.startBinding as FixedPointBinding).fixedPoint[1],
    ).toBeLessThanOrEqual(1);
    expect(arrow.endBinding).toBe(null);
  });
});
