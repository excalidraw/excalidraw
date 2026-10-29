import type {
  ExcalidrawFreeDrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

const { h } = window;

describe("freedraw mode action", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("applies currentItemStrokeVariability to newly drawn freedraw elements", () => {
    // default app state draws constant-width strokes
    expect(h.state.currentItemStrokeVariability).toBe("constant");

    UI.createElement("freedraw", { x: 0, y: 0 });

    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
  });

  it("snaps a Shift-constrained freedraw stroke to a discrete angle", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    const projectedDistance = 50 + 75 * Math.sqrt(3);
    Keyboard.withModifierKeys({ shift: true }, () => {
      pointer.downAt(100, 100);
      pointer.moveTo(200, 250);

      const liveElement = h.state.newElement as ExcalidrawFreeDrawElement;
      expect(liveElement.points).toHaveLength(2);
      expect(liveElement.points[1][0]).toBeCloseTo(projectedDistance / 2, 3);
      expect(liveElement.points[1][1]).toBeCloseTo(
        (projectedDistance * Math.sqrt(3)) / 2,
        3,
      );

      pointer.upAt(200, 250);
    });

    const element = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(element.points.at(-1)?.[0]).toBeCloseTo(projectedDistance / 2, 3);
    expect(element.points.at(-1)?.[1]).toBeCloseTo(
      (projectedDistance * Math.sqrt(3)) / 2,
      3,
    );
  });

  it.each(Array.from({ length: 24 }, (_, index) => (index - 12) * 15))(
    "snaps free-draw to the nearest %s-degree angle",
    (angleDegrees) => {
      UI.clickTool("freedraw");

      const snappedAngle = (angleDegrees * Math.PI) / 180;
      const inputAngle = snappedAngle + (7 * Math.PI) / 180;
      const projectedDistance = 100 * Math.cos((7 * Math.PI) / 180);
      const pointer = new Pointer("mouse");
      const endX = 100 + 100 * Math.cos(inputAngle);
      const endY = 100 + 100 * Math.sin(inputAngle);

      Keyboard.withModifierKeys({ shift: true }, () => {
        pointer.downAt(100, 100);
        pointer.moveTo(endX, endY);
        pointer.upAt(endX, endY);
      });

      const element = h.elements[0] as ExcalidrawFreeDrawElement;
      const endpoint = element.points.at(-1)!;
      expect(endpoint[0]).toBeCloseTo(
        projectedDistance * Math.cos(snappedAngle),
        3,
      );
      expect(endpoint[1]).toBeCloseTo(
        projectedDistance * Math.sin(snappedAngle),
        3,
      );
    },
  );

  it("constrains an existing stroke when Shift is pressed at its last point", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    pointer.downAt(100, 100);
    pointer.moveTo(130, 130);
    pointer.moveTo(160, 160);

    expect(
      (h.state.newElement as ExcalidrawFreeDrawElement).points,
    ).toHaveLength(3);

    Keyboard.withModifierKeys({ shift: true }, () => {
      pointer.moveTo(160, 160);
    });

    const element = h.state.newElement as ExcalidrawFreeDrawElement;
    expect(element.points).toHaveLength(2);
    expect(element.points[1][0]).toBeCloseTo(60, 3);
    expect(element.points[1][1]).toBeCloseTo(60, 3);

    pointer.upAt(160, 160);
  });

  it("restores raw freehand samples when Shift is released mid-stroke", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    pointer.downAt(100, 100);
    pointer.moveTo(130, 130);
    Keyboard.withModifierKeys({ shift: true }, () => {
      pointer.moveTo(160, 160);
    });

    Keyboard.withModifierKeys({ shift: false }, () => {
      pointer.moveTo(170, 150);
    });

    const element = h.state.newElement as ExcalidrawFreeDrawElement;
    expect(element.points).toHaveLength(4);
    expect(element.points[1][0]).toBe(30);
    expect(element.points[1][1]).toBe(30);
    expect(element.points[2][0]).toBe(60);
    expect(element.points[2][1]).toBe(60);
    expect(element.points[3][0]).toBe(70);
    expect(element.points[3][1]).toBe(50);

    pointer.upAt(170, 150);
  });

  it("keeps a repeated-point Shift stroke finite on finalization", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    Keyboard.withModifierKeys({ shift: true }, () => {
      pointer.downAt(100, 100);
      pointer.moveTo(100, 100);
      pointer.upAt(100, 100);
    });

    const element = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(element.points).toHaveLength(2);
    expect(Number.isFinite(element.points[1][0])).toBe(true);
    expect(Number.isFinite(element.points[1][1])).toBe(true);
    expect(element.points[1][0]).toBeGreaterThan(0);
    expect(element.points[1][1]).toBe(0);
  });

  it.each([
    { x: 200, y: 100, expectedX: 100, expectedY: 0 },
    { x: 100, y: 200, expectedX: 0, expectedY: 100 },
    { x: 200, y: 200, expectedX: 100, expectedY: 100 },
    { x: 200, y: 0, expectedX: 100, expectedY: -100 },
  ])(
    "keeps constrained intermediate points collinear for ($x, $y)",
    ({ x, y, expectedX, expectedY }) => {
      UI.clickTool("freedraw");

      const pointer = new Pointer("mouse");
      Keyboard.withModifierKeys({ shift: true }, () => {
        pointer.downAt(100, 100);
        pointer.moveTo(x - 20, y - 10);

        let element = h.state.newElement as ExcalidrawFreeDrawElement;
        expect(element.points).toHaveLength(2);

        pointer.moveTo(x, y);
        element = h.state.newElement as ExcalidrawFreeDrawElement;
        expect(element.points).toHaveLength(2);
        expect(element.points[1][0]).toBeCloseTo(expectedX, 3);
        expect(element.points[1][1]).toBeCloseTo(expectedY, 3);

        pointer.upAt(x, y);
      });
    },
  );

  it("preserves ordinary freehand points when Shift is not pressed", () => {
    UI.clickTool("freedraw");

    const pointer = new Pointer("mouse");
    pointer.downAt(100, 100);
    pointer.moveTo(130, 125);
    pointer.moveTo(160, 140);
    pointer.upAt(180, 150);

    const element = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(element.points).toEqual([
      [0, 0],
      [30, 25],
      [60, 40],
      [80, 50],
    ]);
  });

  it("toggling the radio updates both the selected element and the default", () => {
    const element = UI.createElement("freedraw", { x: 0, y: 0 });
    API.setSelectedElements([element.get()] as NonDeletedExcalidrawElement[]);

    fireEvent.click(screen.getByTitle("Variable"));
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("variable");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
    expect(h.state.currentItemStrokeVariability).toBe("variable");

    fireEvent.click(screen.getByTitle("Constant"));
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
    expect(h.state.currentItemStrokeVariability).toBe("constant");
  });
});
