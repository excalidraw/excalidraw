import { KEYS, ROUNDNESS, arrayToMap } from "@excalidraw/common";

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

import type { Radians } from "@excalidraw/math";

import type { Zoom } from "@excalidraw/excalidraw/types";

import {
  bindBindingElement,
  getBindingGap,
  updateBoundElements,
} from "../src/binding";
import { getAllMidpoints } from "../src/utils";
import { getTransformHandles } from "../src/transformHandles";
import {
  getTextEditor,
  TEXT_EDITOR_SELECTOR,
} from "../../excalidraw/tests/queries/dom";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawLinearElement,
  FixedPointBinding,
  NonDeleted,
} from "../src/types";

const { h } = window;

const mouse = new Pointer("mouse");

describe("binding for simple arrows", () => {
  describe("when both endpoints are bound inside the same element", () => {
    beforeEach(async () => {
      mouse.reset();

      await act(() => {
        return setLanguage(defaultLang);
      });
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("should create an `inside` binding", () => {
      // Create a rectangle
      UI.clickTool("rectangle");
      mouse.reset();
      mouse.downAt(100, 100);
      mouse.moveTo(200, 200);
      mouse.up();

      const rect = API.getSelectedElement();

      // Draw arrow with endpoint inside the filled rectangle
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
      expect(startBinding.mode).toBe("inside");

      const endBinding = arrow.endBinding as FixedPointBinding;
      expect(endBinding.fixedPoint[0]).toBeGreaterThanOrEqual(0);
      expect(endBinding.fixedPoint[0]).toBeLessThanOrEqual(1);
      expect(endBinding.fixedPoint[1]).toBeGreaterThanOrEqual(0);
      expect(endBinding.fixedPoint[1]).toBeLessThanOrEqual(1);
      expect(endBinding.mode).toBe("inside");

      // Move the bindable
      mouse.downAt(100, 150);
      mouse.moveTo(280, 110);
      mouse.up();

      // Check if the arrow moved
      expect(arrow.x).toBe(290);
      expect(arrow.y).toBe(70);

      // Restore bindable
      mouse.reset();
      mouse.downAt(280, 110);
      mouse.moveTo(130, 110);
      mouse.up();

      // Move the start point of the arrow to check if
      // the behavior remains the same for old arrows
      mouse.reset();
      mouse.downAt(110, 110);
      mouse.moveTo(120, 120);
      mouse.up();

      // Move the bindable again
      mouse.reset();
      mouse.downAt(130, 110);
      mouse.moveTo(280, 110);
      mouse.up();

      // Check if the arrow moved
      expect(arrow.x).toBe(290);
      expect(arrow.y).toBe(70);
    });

    it("3+ point arrow should be dragged along with the bindable", () => {
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
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
        },
        endBinding: {
          elementId: rectRight.id,
          fixedPoint: [0.5, 0.5],
          mode: "orbit",
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

  describe("self-binding (both ends to the same element) single-click finalize", () => {
    // rect spans x:200..400, y:200..400; orbit ring is ~15px outside the outline
    const INSIDE: [number, number] = [250, 250];
    const ORBIT_LEFT: [number, number] = [187, 300];
    const ORBIT_RIGHT: [number, number] = [413, 300];
    const MIDDLE: [number, number] = [550, 100];

    beforeEach(async () => {
      mouse.reset();
      await act(() => setLanguage(defaultLang));
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      UI.createElement("rectangle", {
        x: 200,
        y: 200,
        width: 200,
        height: 200,
      });
    });

    const drawSelfArrow = (start: [number, number], end: [number, number]) => {
      UI.clickTool("arrow");
      mouse.reset();
      mouse.clickAt(...start);
      mouse.moveTo(...MIDDLE);
      mouse.clickAt(...MIDDLE); // commit a middle point so it's a multi-point arrow
      mouse.moveTo(...end);
      mouse.clickAt(...end); // single click at the end
    };

    it("orbit -> orbit finalizes on a single click", () => {
      drawSelfArrow(ORBIT_LEFT, ORBIT_RIGHT);

      const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
      expect(h.state.multiElement).toBe(null);
      expect(h.state.activeTool.type).toBe("selection");
      expect(arrow.startBinding?.elementId).toBe(arrow.endBinding?.elementId);
      expect(arrow.endBinding?.elementId).not.toBe(undefined);
    });

    it("inside -> orbit finalizes on a single click", () => {
      drawSelfArrow(INSIDE, ORBIT_RIGHT);

      const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
      expect(h.state.multiElement).toBe(null);
      expect(h.state.activeTool.type).toBe("selection");
      expect(arrow.startBinding?.elementId).toBe(arrow.endBinding?.elementId);
      expect(arrow.endBinding?.elementId).not.toBe(undefined);
    });

    it("inside -> inside keep in multi-point mode (no single-click finalize)", () => {
      drawSelfArrow(INSIDE, [INSIDE[0] + 50, INSIDE[1] + 50]); // end dropped inside the rect

      // ambiguous → must be confirmed with a second click, so still in progress
      expect(h.state.multiElement).not.toBe(null);
      expect(h.state.activeTool.type).toBe("arrow");
    });

    it("inside -> inside stays in multi-point mode when the pointer moves on", () => {
      const end: [number, number] = [INSIDE[0] + 50, INSIDE[1] + 50];
      drawSelfArrow(INSIDE, end);
      // nudge within the commit zone of the point just placed
      mouse.moveTo(end[0] + 2, end[1] + 1);

      expect(h.state.multiElement).not.toBe(null);
      expect(h.state.activeTool.type).toBe("arrow");
      expect(h.state.multiElement!.points.length).toBe(3);
    });

    it("bend point inside a shape the arrow doesn't start on stays in multi-point mode when the pointer moves on", () => {
      UI.clickTool("arrow");
      mouse.reset();
      mouse.clickAt(...MIDDLE);
      mouse.moveTo(...INSIDE);
      mouse.clickAt(...INSIDE);
      mouse.moveTo(INSIDE[0] + 2, INSIDE[1] + 1);

      expect(h.state.multiElement).not.toBe(null);
      expect(h.state.activeTool.type).toBe("arrow");
      expect(h.state.multiElement!.points.length).toBe(2);
    });
  });

  describe("binding to frames", () => {
    // frame spans x:200..600, y:200..600, child rect x:300..400, y:300..400
    beforeEach(async () => {
      mouse.reset();
      await act(() => setLanguage(defaultLang));
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const frame = API.createElement({
        id: "frame",
        type: "frame",
        x: 200,
        y: 200,
        width: 400,
        height: 400,
      });
      const child = API.createElement({
        id: "child",
        type: "rectangle",
        x: 300,
        y: 300,
        width: 100,
        height: 100,
        frameId: frame.id,
      });
      API.setElements([frame, child]);
    });

    const drawArrow = (end: [number, number]) => {
      UI.clickTool("arrow");
      mouse.reset();
      mouse.downAt(50, 50);
      mouse.moveTo(end[0] - 10, end[1] - 10);
      mouse.moveTo(...end);
      mouse.up();

      return h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
    };

    it("doesn't bind an arrow ending in the frame's empty interior", () => {
      const arrow = drawArrow([500, 500]);

      expect(arrow.endBinding).toBe(null);
    });

    it("binds an arrow ending on a frame child to the child", () => {
      const arrow = drawArrow([350, 350]);

      expect(arrow.endBinding?.elementId).toBe("child");
    });

    it("binds an arrow ending just outside the frame to the frame", () => {
      const arrow = drawArrow([500, 610]);

      expect(arrow.endBinding?.elementId).toBe("frame");
      expect(arrow.endBinding?.mode).toBe("orbit");
    });

    it("keeps an elbow arrow drawn inside the frame where it was drawn", () => {
      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.downAt(250, 250);
      mouse.moveTo(400, 450);
      mouse.moveTo(550, 550);
      mouse.up();

      const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
      expect(arrow.elbowed).toBe(true);
      // no self-orbit binding to the frame, which would route the arrow
      // around the frame's outside
      expect(arrow.startBinding).toBe(null);
      expect(arrow.endBinding).toBe(null);
      expect(arrow.frameId).toBe("frame");
      expect([arrow.x, arrow.y]).toEqual([250, 250]);
      expect(arrow.points[arrow.points.length - 1]).toEqual([300, 300]);
    });
  });

  describe("binding at an ellipse's center", () => {
    beforeEach(async () => {
      mouse.reset();
      await act(() => setLanguage(defaultLang));
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("binds an arrow dropped at a circle's exact center", () => {
      const circle = API.createElement({
        type: "ellipse",
        x: 100,
        y: -100,
        width: 200,
        height: 200,
      });
      API.setElements([circle]);

      UI.clickTool("arrow");
      mouse.reset();
      mouse.downAt(-100, 0);
      mouse.moveTo(100, 0);
      mouse.moveTo(200, 0);
      mouse.up();

      const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
      expect(arrow.endBinding?.elementId).toBe(circle.id);
    });
  });

  describe("midpoint snapping on diamonds", () => {
    beforeEach(async () => {
      mouse.reset();
      await act(() => setLanguage(defaultLang));
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    for (const rounded of [false, true]) {
      for (const elbowed of [false, true]) {
        it(`${
          elbowed ? "elbow" : "simple"
        } arrow ends a binding gap outside the ${
          rounded ? "rounded" : "sharp"
        } left vertex`, () => {
          const diamond = API.createElement({
            type: "diamond",
            x: 100,
            y: -100,
            width: 200,
            height: 200,
            roundness: rounded ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null,
          }) as ExcalidrawBindableElement;
          API.setElements([diamond]);
          const [, , left] = getAllMidpoints(diamond, arrayToMap([diamond]));

          UI.clickTool("arrow");
          if (elbowed) {
            UI.clickOnTestId("elbow-arrow");
          }
          mouse.reset();
          mouse.downAt(-200, left[1]);
          mouse.moveTo(left[0] - 50, left[1]);
          // near (not on) the vertex, so the end snaps to it
          mouse.moveTo(left[0] - 4, left[1] + 2);
          mouse.up();

          const arrow = h.elements[
            h.elements.length - 1
          ] as ExcalidrawArrowElement;
          const [endX, endY] = arrow.points[arrow.points.length - 1];

          expect(arrow.endBinding?.elementId).toBe(diamond.id);
          expect(arrow.x + endX).toBeCloseTo(
            left[0] - getBindingGap(diamond),
            0,
          );
          expect(arrow.y + endY).toBeCloseTo(left[1], 0);
        });
      }

      it(`elbow arrow binds above the ${
        rounded ? "rounded" : "sharp"
      } top vertex when the pointer is slightly inside`, () => {
        const diamond = API.createElement({
          type: "diamond",
          x: 100,
          y: -100,
          width: 300,
          height: 300,
          roundness: rounded ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null,
        }) as ExcalidrawBindableElement;
        API.setElements([diamond]);
        const [, , , top] = getAllMidpoints(diamond, arrayToMap([diamond]));

        UI.clickTool("arrow");
        UI.clickOnTestId("elbow-arrow");
        mouse.reset();
        mouse.downAt(top[0] - 300, top[1] - 100);
        mouse.moveTo(top[0] - 50, top[1] - 50);
        // inside the diamond, a bit right of the vertex
        mouse.moveTo(top[0] + 3, top[1] + 10);
        mouse.up();

        const arrow = h.elements[
          h.elements.length - 1
        ] as ExcalidrawArrowElement;
        const points = arrow.points;
        const [endX, endY] = points[points.length - 1];

        expect(arrow.endBinding?.elementId).toBe(diamond.id);
        expect(arrow.x + endX).toBeCloseTo(top[0], 0);
        expect(arrow.y + endY).toBeCloseTo(top[1] - getBindingGap(diamond), 0);
        // the last segment comes straight down into the vertex
        expect(points[points.length - 2][0]).toBeCloseTo(endX);
      });
    }

    it("elbow arrow binds next to the tip of a thin rotated diamond", () => {
      const diamond = API.createElement({
        type: "diamond",
        x: 0,
        y: 0,
        width: 600,
        height: 100,
        angle: ((15 * Math.PI) / 180) as Radians,
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      }) as ExcalidrawBindableElement;
      API.setElements([diamond]);
      const [right] = getAllMidpoints(diamond, arrayToMap([diamond]));

      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.downAt(right[0] + 300, right[1] + 300);
      mouse.moveTo(right[0] + 50, right[1] + 50);
      // just outside the right tip
      mouse.moveTo(right[0] + 4, right[1] + 1);
      mouse.up();

      const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
      const [endX, endY] = arrow.points[arrow.points.length - 1];

      expect(arrow.endBinding?.elementId).toBe(diamond.id);
      // a binding gap away, not on another edge of the diamond
      expect(
        Math.hypot(arrow.x + endX - right[0], arrow.y + endY - right[1]),
      ).toBeLessThan(getBindingGap(diamond) + 2);
    });

    it("elbow arrow snaps to a diamond's edge midpoint", () => {
      const diamond = API.createElement({
        type: "diamond",
        x: 100,
        y: -100,
        width: 200,
        height: 200,
      }) as ExcalidrawBindableElement;
      API.setElements([diamond]);
      // midpoint of the top-left edge
      const edgeMidpoint = [150, -50] as const;

      UI.clickTool("arrow");
      UI.clickOnTestId("elbow-arrow");
      mouse.reset();
      mouse.downAt(-200, -50);
      mouse.moveTo(100, -60);
      // near (not on) the edge midpoint
      mouse.moveTo(edgeMidpoint[0] - 9, edgeMidpoint[1] - 3);
      mouse.up();

      const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
      const [, endY] = arrow.points[arrow.points.length - 1];

      expect(arrow.endBinding?.elementId).toBe(diamond.id);
      expect(arrow.y + endY).toBeCloseTo(edgeMidpoint[1], 0);
    });
  });

  describe("when arrow is outside of shape", () => {
    beforeEach(async () => {
      mouse.reset();

      await act(() => {
        return setLanguage(defaultLang);
      });
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("should handle new arrow start point binding", () => {
      // Create a rectangle
      UI.clickTool("rectangle");
      mouse.downAt(100, 100);
      mouse.moveTo(200, 200);
      mouse.up();

      const rectangle = API.getSelectedElement();

      // Create arrow with arrow tool
      UI.clickTool("arrow");
      mouse.downAt(205, 150); // Start close to rectangle
      mouse.moveTo(250, 150); // End outside
      mouse.up();

      const arrow = API.getSelectedElement() as ExcalidrawLinearElement;

      // Arrow should have start binding to rectangle
      expect(arrow.startBinding?.elementId).toBe(rectangle.id);
      expect(arrow.startBinding?.mode).toBe("orbit"); // Default is orbit, not inside
      expect(arrow.endBinding).toBeNull();
    });

    it("should handle new arrow end point binding", () => {
      // Create a rectangle
      UI.clickTool("rectangle");
      mouse.downAt(100, 100);
      mouse.moveTo(200, 200);
      mouse.up();

      const rectangle = API.getSelectedElement();

      // Create arrow with end point in binding zone
      UI.clickTool("arrow");
      mouse.downAt(50, 150); // Start outside
      mouse.moveTo(95, 95); // End near rectangle edge (should bind as orbit)
      mouse.up();

      const arrow = API.getSelectedElement() as ExcalidrawLinearElement;

      // Arrow should have end binding to rectangle
      expect(arrow.endBinding?.elementId).toBe(rectangle.id);
      expect(arrow.endBinding?.mode).toBe("orbit");
      expect(arrow.startBinding).toBeNull();
    });

    it.skip("should create orbit binding when one of the cursor is inside rectangle", () => {
      // Create a filled solid rectangle
      UI.clickTool("rectangle");
      mouse.downAt(100, 100);
      mouse.moveTo(200, 200);
      mouse.up();

      const rect = API.getSelectedElement();
      API.updateElement(rect, {
        fillStyle: "solid",
        backgroundColor: "#a5d8ff",
      });

      // Draw arrow with endpoint inside the filled rectangle, since only
      // filled bindables bind inside the shape
      UI.clickTool("arrow");
      mouse.downAt(10, 10);
      mouse.moveTo(160, 160);
      mouse.up();

      const arrow = API.getSelectedElement() as ExcalidrawLinearElement;
      expect(arrow.x).toBe(10);
      expect(arrow.y).toBe(10);
      expect(arrow.width).toBeCloseTo(85.75985931287957);
      expect(arrow.height).toBeCloseTo(85.75985931288186);

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
      expect(arrow.width).toBeCloseTo(234);
      expect(arrow.height).toBeCloseTo(117);

      // Restore bindable
      mouse.reset();
      mouse.downAt(280, 110);
      mouse.moveTo(130, 110);
      mouse.up();

      // Move the arrow out
      mouse.reset();
      mouse.click(10, 10);
      mouse.downAt(96.466, 96.466);
      mouse.moveTo(50, 50);
      mouse.up();

      expect(arrow.startBinding).toBe(null);
      expect(arrow.endBinding).toBe(null);

      // Re-bind the arrow by moving the cursor inside the rectangle
      mouse.reset();
      mouse.downAt(50, 50);
      mouse.moveTo(150, 150);
      mouse.up();

      // Check if the arrow is still on the outside
      expect(arrow.width).toBeCloseTo(86, 0);
      expect(arrow.height).toBeCloseTo(86, 0);
    });
  });

  describe("additional binding behavior", () => {
    beforeEach(async () => {
      mouse.reset();

      await act(() => {
        return setLanguage(defaultLang);
      });
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it(
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

        // Edit arrow
        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.ENTER);
        });

        // move arrow head
        mouse.down();
        mouse.up(0, 10);
        expect(API.getSelectedElement().type).toBe("arrow");

        expect(h.state.selectedLinearElement?.isEditing).toBe(true);
        mouse.reset();
        mouse.clickAt(-50, -50);
        expect(h.state.selectedLinearElement?.isEditing).toBe(false);
        expect(API.getSelectedElement().type).toBe("arrow");

        // Edit arrow
        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.ENTER);
        });
        expect(h.state.selectedLinearElement?.isEditing).toBe(true);
        mouse.reset();
        mouse.clickAt(0, 0);
        expect(h.state.selectedLinearElement).toBeNull();
        expect(API.getSelectedElement().type).toBe("rectangle");
      },
    );

    it("should unbind on bound element deletion", () => {
      const rectangle = UI.createElement("rectangle", {
        x: 60,
        y: 0,
        size: 100,
      });

      const arrow = UI.createElement("arrow", {
        x: 0,
        y: 5,
        size: 70,
      });

      expect(arrow.endBinding?.elementId).toBe(rectangle.id);

      mouse.select(rectangle);
      expect(API.getSelectedElement().type).toBe("rectangle");
      Keyboard.keyDown(KEYS.DELETE);
      expect(arrow.endBinding).toBe(null);
    });

    it("should unbind arrow when arrow is resized", () => {
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
      UI.clickTool("arrow");
      mouse.reset();
      mouse.clickAt(190, 250);
      mouse.moveTo(220, 200);
      mouse.moveTo(300, 200);
      mouse.clickAt(300, 200);
      mouse.moveTo(340, 251);
      mouse.moveTo(410, 251);
      mouse.clickAt(410, 251);
      mouse.clickAt(410, 251);
      const arrow = h.elements[h.elements.length - 1] as any;

      expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
      expect(arrow.endBinding?.elementId).toBe(rectRight.id);

      // Drag arrow off of bound rectangle range
      const handles = getTransformHandles(
        arrow,
        h.state.zoom,
        arrayToMap(h.elements),
        "mouse",
      ).se!;

      const elX = handles[0] + handles[2] / 2;
      const elY = handles[1] + handles[3] / 2;
      // move first, as a real pointer would — the hover state from the spot
      // where arrow creation finished must clear before the pointerdown
      mouse.moveTo(elX, elY);
      mouse.downAt(elX, elY);
      mouse.moveTo(300, 400);
      mouse.up();

      expect(arrow.startBinding).toBe(null);
      expect(arrow.endBinding).toBe(null);
    });

    it("should unbind arrow when arrow is rotated", () => {
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

      UI.clickTool("arrow");
      mouse.reset();
      mouse.clickAt(190, 250);
      mouse.moveTo(220, 200);
      mouse.moveTo(300, 200);
      mouse.clickAt(300, 200);
      mouse.moveTo(350, 251);
      mouse.moveTo(410, 251);
      mouse.clickAt(410, 251);
      mouse.clickAt(410, 251);

      const arrow = API.getSelectedElement() as ExcalidrawArrowElement;

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
      mouse.reset();
      mouse.down(rotationHandleX, rotationHandleY);
      mouse.move(300, 400);
      mouse.up();
      expect(arrow.angle).toBeGreaterThan(0.7 * Math.PI);
      expect(arrow.angle).toBeLessThan(1.3 * Math.PI);
      expect(arrow.startBinding).toBeNull();
      expect(arrow.endBinding).toBeNull();
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
        x: 190,
        y: 250,
        width: 217,
        height: 1,
      });
      expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
      expect(arrow.endBinding?.elementId).toBe(rectRight.id);

      mouse.downAt(-100, -100);
      mouse.moveTo(0, 0);
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

  describe("to text elements", () => {
    beforeEach(async () => {
      mouse.reset();

      await act(() => {
        return setLanguage(defaultLang);
      });
      await render(<Excalidraw handleKeyboardGlobally={true} />);
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
          fixedPoint: [0.5, 1],
          mode: "orbit",
        },
        endBinding: {
          elementId: "text1",
          fixedPoint: [1, 0.5],
          mode: "orbit",
        },
      });

      const arrow2 = API.createElement({
        type: "arrow",
        id: "arrow2",
        points: [pointFrom(0, 0), pointFrom(0, -87.45777932247563)],
        startBinding: {
          elementId: "text1",
          fixedPoint: [0.5, 1],
          mode: "orbit",
        },
        endBinding: {
          elementId: "rectangle1",
          fixedPoint: [1, 0.5],
          mode: "orbit",
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
        size: 65,
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

    it("should unbind on text element deletion by submitting empty text", async () => {
      const text = API.createElement({
        type: "text",
        text: "¡olá!",
        x: 60,
        y: 0,
        width: 100,
        height: 100,
      });

      API.setElements([text]);

      const arrow = UI.createElement("arrow", {
        x: 0,
        y: 0,
        size: 65,
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
  });
});

describe("binding to a point-like (sub-pixel) element", () => {
  beforeEach(async () => {
    mouse.reset();
    await act(() => setLanguage(defaultLang));
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // Regression: binding to a zero/near-zero-size element used to yield an
  // enormous fixedPoint ratio (offset / ~0), which exploded into an arrow
  // hundreds of thousands of px wide once the element was resized to a normal
  // size
  it.each([
    ["simple", false],
    ["elbow", true],
  ])(
    "%s arrow binds to the center and stays put when the element grows",
    (_label, elbowed) => {
      const rect = API.createElement({
        type: "rectangle",
        x: 200,
        y: 50,
        width: 0.00005,
        height: 0.00005,
      }) as NonDeleted<ExcalidrawBindableElement>;
      const arrow = API.createElement({
        type: "arrow",
        elbowed,
        x: 0,
        y: 50,
        width: 195,
        height: 0,
        points: [pointFrom(0, 0), pointFrom(195, 0)],
      }) as NonDeleted<ExcalidrawArrowElement>;
      API.setElements([rect, arrow]);

      bindBindingElement(arrow, rect, "orbit", "end", h.scene, {
        value: 1,
      } as Zoom);

      const endBinding = arrow.endBinding as FixedPointBinding;
      expect(endBinding.elementId).toBe(rect.id);
      // Point-like element => bind to center (0.5 is normalized to 0.5001)
      expect(endBinding.fixedPoint[0]).toBeCloseTo(0.5001);
      expect(endBinding.fixedPoint[1]).toBeCloseTo(0.5001);

      // Grow the element to a normal size and let bound arrows follow
      h.scene.mutateElement(rect, { width: 300, height: 200 });
      updateBoundElements(rect, h.scene);

      // The arrow endpoint must track the element (its center), not fly off
      expect(Math.abs(arrow.width)).toBeLessThan(1000);
      expect(Math.abs(arrow.height)).toBeLessThan(1000);
    },
  );
});
