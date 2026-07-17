import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard, Pointer } from "./helpers/ui";
import { GlobalTestState, act, fireEvent, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const sketch = (points: [number, number][]) => {
  const [startX, startY] = points[0];

  mouse.downAt(startX, startY);
  act(() => {
    for (const [x, y] of points.slice(1)) {
      h.app.drawShape.trail.addPointToPath(x, y);
    }
  });
  const [endX, endY] = points[points.length - 1];
  mouse.upAt(endX, endY);
};

/** a closed, roughly rectangular path */
const rectanglePath = (
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number][] => {
  const points: [number, number][] = [];
  const step = 10;
  for (let i = x; i <= x + width; i += step) {
    points.push([i, y]);
  }
  for (let i = y; i <= y + height; i += step) {
    points.push([x + width, i]);
  }
  for (let i = x + width; i >= x; i -= step) {
    points.push([i, y + height]);
  }
  for (let i = y + height; i >= y; i -= step) {
    points.push([x, i]);
  }
  points.push([x, y]);
  return points;
};

/** a closed, roughly circular path */
const circlePath = (
  cx: number,
  cy: number,
  radius: number,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
    points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  return points;
};

describe("drawShape tool", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "drawShape" });
    });
  });

  it("converts a sketched rectangle into a rectangle element", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("rectangle");
  });

  it("converts a sketched circle into an ellipse element", () => {
    sketch(circlePath(300, 300, 80));

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("ellipse");
  });

  it("keeps the drawShape tool active after finalizing a shape", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("does not select the recognized element, so styles stay tool defaults", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("allows sketching consecutive shapes without reselecting the tool", () => {
    sketch(rectanglePath(100, 100, 200, 120));
    sketch(circlePath(600, 300, 80));

    expect(h.elements).toHaveLength(2);
    expect(h.elements[0].type).toBe("rectangle");
    expect(h.elements[1].type).toBe("ellipse");
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("ignores a sketch too small to be a shape", () => {
    sketch([
      [100, 100],
      [101, 101],
      [102, 100],
      [101, 99],
    ]);

    expect(h.elements).toHaveLength(0);
    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("applies its own cursor while active", () => {
    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("url(");
  });
});

describe("drawShape tool activation", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("activates via its keyboard shortcut", () => {
    expect(h.state.activeTool.type).toBe("selection");

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.X);
    });

    expect(h.state.activeTool.type).toBe("drawShape");
  });

  it("is not activated by an unmodified X (freedraw's shortcut)", () => {
    Keyboard.keyPress(KEYS.X);

    expect(h.state.activeTool.type).toBe("freedraw");
  });

  it("activates from the extra tools dropdown", () => {
    fireEvent.click(
      GlobalTestState.renderResult.container.querySelector(
        ".App-toolbar__extra-tools-trigger",
      )!,
    );

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-drawShape"]',
      )!,
    );

    expect(h.state.activeTool.type).toBe("drawShape");
  });
});
