import { KEYS } from "@excalidraw/common";

import { getTargetElements, isArrowElement } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { actionFinalize } from "../actions";
import { getShapeActionPredicates } from "../components/shapeActionPredicates";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { GlobalTestState, act, fireEvent, render, waitFor } from "./test-utils";

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

const seg = (
  from: [number, number],
  to: [number, number],
  steps: number,
): [number, number][] => {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    points.push([
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    ]);
  }
  return points;
};

/** a V-headed arrow: the shaft, then both head arms drawn back from the tip */
const arrowPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number][] => {
  const tip: [number, number] = [x2, y2];
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const headLength = length * 0.3;
  const headAngle = Math.PI / 6;
  const arm = (sign: number): [number, number] => [
    x2 -
      headLength * (ux * Math.cos(headAngle) - sign * uy * Math.sin(headAngle)),
    y2 -
      headLength * (uy * Math.cos(headAngle) + sign * ux * Math.sin(headAngle)),
  ];
  return [
    ...seg([x1, y1], tip, 20),
    ...seg(tip, arm(1), 8),
    ...seg(arm(1), tip, 8),
    ...seg(tip, arm(-1), 8),
  ];
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

describe("autoshape tool", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "autoshape" });
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

  it("keeps the autoshape tool active after finalizing a shape", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.state.activeTool.type).toBe("autoshape");
  });

  it("does not select the recognized element, so styles stay tool defaults", () => {
    sketch(rectanglePath(100, 100, 200, 120));

    expect(h.elements).toHaveLength(1);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("does not select a recognized arrow, yet still binds it", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 300,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    sketch(arrowPath(160, 160, 390, 290));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(h.state.selectedLinearElement).toBeNull();
    expect(h.state.selectedElementIds).toEqual({});

    expect(arrow.startBinding?.elementId).toBe(start.id);
    expect(arrow.endBinding?.elementId).toBe(end.id);
  });

  it("does not select a recognized arrow that binds nothing", () => {
    sketch(arrowPath(100, 100, 400, 300));

    expect(h.elements.map((element) => element.type)).toEqual(["arrow"]);
    expect(h.state.selectedLinearElement).toBeNull();
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("upgrades a line drawn between two bindable shapes to a bound arrow", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    sketch(seg([205, 205], [395, 395], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.elementId).toBe(start.id);
    expect(arrow.endBinding?.elementId).toBe(end.id);
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.selectedLinearElement).toBeNull();
  });

  it("orbit-binds arrows sketched from inside one shape into another, endpoints on the outlines", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    // starts and ends deep inside the shapes
    sketch(seg([150, 150], [450, 450], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.mode).toBe("orbit");
    expect(arrow.endBinding?.mode).toBe("orbit");

    // the endpoints were pulled out of the shape interiors onto the outlines
    const [endDx, endDy] = arrow.points[arrow.points.length - 1];
    expect(arrow.x).toBeGreaterThan(200);
    expect(arrow.y).toBeGreaterThan(200);
    expect(arrow.x + endDx).toBeLessThan(400);
    expect(arrow.y + endDy).toBeLessThan(400);
  });

  it("keeps inside-bindings for an arrow sketched within a single shape", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 500,
      height: 500,
    });
    API.setElements([container]);

    sketch(arrowPath(150, 300, 400, 300));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.mode).toBe("inside");
    expect(arrow.endBinding?.mode).toBe("inside");
    // the endpoints stay where they were drawn
    expect(arrow.x).toBeCloseTo(150, 0);
    expect(arrow.y).toBeCloseTo(300, 0);
  });

  it("keeps a line sketched within a single shape a line", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 500,
      height: 500,
    });
    API.setElements([container]);

    sketch(seg([150, 150], [450, 450], 30));

    expect(h.elements.map((element) => element.type)).toEqual([
      "rectangle",
      "line",
    ]);
  });

  it("upgrades a line from inside a shape to blank canvas into an arrow orbit-bound at the shape", () => {
    const only = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    API.setElements([only]);

    sketch(seg([150, 150], [395, 395], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.elementId).toBe(only.id);
    expect(arrow.startBinding?.mode).toBe("orbit");
    expect(arrow.endBinding).toBeNull();
    // the start was pulled out of the shape interior onto the outline
    expect(arrow.x).toBeGreaterThan(200);
    expect(arrow.y).toBeGreaterThan(200);
  });

  it("upgrades a line from blank canvas into a shape into an arrow orbit-bound at the shape", () => {
    const only = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([only]);

    sketch(seg([100, 100], [450, 450], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding).toBeNull();
    expect(arrow.endBinding?.elementId).toBe(only.id);
    expect(arrow.endBinding?.mode).toBe("orbit");
    // the end was pulled back onto the outline
    const [endDx, endDy] = arrow.points[arrow.points.length - 1];
    expect(arrow.x + endDx).toBeLessThan(400);
    expect(arrow.y + endDy).toBeLessThan(400);
  });

  it("keeps a line touching no shape a line", () => {
    sketch(seg([100, 100], [400, 400], 30));

    expect(h.elements.map((element) => element.type)).toEqual(["line"]);
  });

  it("allows sketching consecutive shapes without reselecting the tool", () => {
    sketch(rectanglePath(100, 100, 200, 120));
    sketch(circlePath(600, 300, 80));

    expect(h.elements).toHaveLength(2);
    expect(h.elements[0].type).toBe("rectangle");
    expect(h.elements[1].type).toBe("ellipse");
    expect(h.state.activeTool.type).toBe("autoshape");
  });

  it("ignores a sketch too small to be a shape", () => {
    sketch([
      [100, 100],
      [101, 101],
      [102, 100],
      [101, 99],
    ]);

    expect(h.elements).toHaveLength(0);
    expect(h.state.activeTool.type).toBe("autoshape");
  });
});

describe("autoshape styles panel & selection (preview path)", () => {
  /**
   * Unlike `sketch`, also drives the pointermove handler, so
   * `state.newElement` holds the live recognition preview mid-gesture the way
   * it does in the real app.
   */
  const sketchWithPreview = (points: [number, number][]) => {
    const [startX, startY] = points[0];

    mouse.downAt(startX, startY);
    act(() => {
      for (const [x, y] of points.slice(1)) {
        h.app.drawShape.trail.addPointToPath(x, y);
        h.app.drawShape.handlePointerMove({ x, y });
      }
    });
    const [endX, endY] = points[points.length - 1];
    mouse.upAt(endX, endY);
  };

  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "autoshape" });
    });
  });

  it("does not select a recognized arrow drawn with a live preview", () => {
    sketchWithPreview(arrowPath(100, 100, 400, 300));

    expect(h.elements.map((element) => element.type)).toEqual(["arrow"]);
    expect(h.state.selectedElementIds).toEqual({});
    expect(h.state.selectedLinearElement).toBeNull();
    expect(h.state.activeTool.type).toBe("autoshape");
  });

  it("does not select a recognized rectangle drawn with a live preview", () => {
    sketchWithPreview(rectanglePath(100, 100, 200, 120));

    expect(h.elements.map((element) => element.type)).toEqual(["rectangle"]);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("upgrades a line between two bindable shapes identically with a live preview", () => {
    const start = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    const end = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 100,
      height: 100,
    });
    API.setElements([start, end]);

    sketchWithPreview(seg([205, 205], [395, 395], 30));

    const arrow = h.elements.find((element) => element.type === "arrow");
    assert(isArrowElement(arrow));

    expect(arrow.startBinding?.elementId).toBe(start.id);
    expect(arrow.endBinding?.elementId).toBe(end.id);
    expect(h.state.newElement).toBeNull();
  });

  it("keeps the styles panel on tool defaults while sketching", () => {
    mouse.downAt(100, 100);
    act(() => {
      for (const [x, y] of rectanglePath(100, 100, 200, 120).slice(1)) {
        h.app.drawShape.trail.addPointToPath(x, y);
        h.app.drawShape.handlePointerMove({ x, y });
      }
    });

    // the preview exists, but the styles panel must not target it — it keeps
    // showing the tool defaults
    expect(h.state.newElement?.type).toBe("rectangle");
    const targetElements = getTargetElements(
      h.app.scene.getNonDeletedElementsMap(),
      h.state,
    );
    expect(targetElements).toEqual([]);

    // the drawShape panel is limited to stroke color, background, fill style
    // and stroke style
    const predicates = getShapeActionPredicates(
      h.state,
      targetElements,
      h.app.scene.getNonDeletedElementsMap(),
      h.app,
    );
    expect(predicates.strokeColor).toBe(true);
    expect(predicates.backgroundColor).toBe(true);
    expect(predicates.strokeStyle).toBe(true);
    // fill follows the standard rule: hidden while the background is
    // transparent (the default), shown otherwise
    expect(predicates.fill).toBe(false);
    expect(predicates.strokeWidth).toBe(true);
    expect(predicates.sloppiness).toBe(true);
    expect(predicates.roundness).toBe(false);
    expect(predicates.opacity).toBe(false);
    expect(predicates.layers).toBe(false);

    act(() => {
      h.setState({ currentItemBackgroundColor: "#ffc9c9" });
    });
    expect(
      getShapeActionPredicates(
        h.state,
        targetElements,
        h.app.scene.getNonDeletedElementsMap(),
        h.app,
      ).fill,
    ).toBe(true);

    mouse.upAt(300, 220);
    expect(h.state.selectedElementIds).toEqual({});
  });
});

describe("autoshape finalize funnel", () => {
  /** starts a gesture and leaves the pointer down */
  const startSketch = (points: [number, number][]) => {
    const [startX, startY] = points[0];

    mouse.downAt(startX, startY);
    act(() => {
      for (const [x, y] of points.slice(1)) {
        h.app.drawShape.trail.addPointToPath(x, y);
        h.app.drawShape.handlePointerMove({ x, y });
      }
    });
  };

  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "autoshape" });
    });
  });

  it("commits the pending sketch when actionFinalize fires mid-gesture", () => {
    startSketch(rectanglePath(100, 100, 200, 120));

    act(() => {
      h.app.actionManager.executeAction(actionFinalize);
    });

    expect(h.elements.map((element) => element.type)).toEqual(["rectangle"]);
    expect(h.state.newElement).toBeNull();
    expect(h.app.drawShape.hasPendingGesture()).toBe(false);

    // releasing the pointer must not commit a second element
    mouse.upAt(300, 220);
    expect(h.elements).toHaveLength(1);
  });

  it("commits the sketch when the tool is switched away mid-gesture (paste resets the tool)", () => {
    startSketch(rectanglePath(100, 100, 200, 120));

    act(() => {
      h.app.setActiveTool({ type: "selection" });
    });

    expect(h.elements.map((element) => element.type)).toEqual(["rectangle"]);
    expect(h.app.drawShape.hasPendingGesture()).toBe(false);
    expect(h.state.newElement).toBeNull();
    expect(h.state.activeTool.type).toBe("selection");

    mouse.upAt(300, 220);
    expect(h.elements).toHaveLength(1);
  });

  it("blocks undo while a sketch is in progress", () => {
    sketch(rectanglePath(100, 100, 200, 120));
    expect(h.elements).toHaveLength(1);

    // start a second gesture; a tiny stroke isn't recognized yet, so
    // `newElement` alone would not block history
    startSketch([
      [600, 100],
      [610, 105],
      [620, 100],
    ]);
    expect(h.state.newElement).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    // undo was blocked — the previously committed shape is still there
    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].isDeleted).toBe(false);

    mouse.upAt(620, 100);
    // the tiny sketch is discarded, the committed shape survives
    expect(h.elements).toHaveLength(1);
    expect(h.app.drawShape.hasPendingGesture()).toBe(false);
  });
});

describe("autoshape double-click to type", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    act(() => {
      h.app.setActiveTool({ type: "autoshape" });
    });
  });

  it("creates free text on blank canvas and stays on the tool after submit", async () => {
    mouse.doubleClickAt(200, 200);

    expect(h.state.editingTextElement).not.toBeNull();
    expect(h.state.activeTool.type).toBe("autoshape");

    const editor = await getTextEditor();
    updateTextEditor(editor, "hello");
    Keyboard.exitTextEditor(editor);

    const text = h.elements[0] as ExcalidrawTextElement;
    expect(h.elements).toHaveLength(1);
    expect(text.type).toBe("text");
    expect(text.containerId).toBeNull();
    expect(h.state.editingTextElement).toBeNull();
    expect(h.state.activeTool.type).toBe("autoshape");
    expect(API.getSelectedElements()).toHaveLength(0);
  });

  it("binds text to a transparent container even off-center (unlike selection mode)", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      backgroundColor: "transparent",
    });
    API.setElements([rectangle]);

    // interior hit far from both the stroke and the center
    mouse.doubleClickAt(140, 120);

    const editor = await getTextEditor();
    expect(h.state.editingTextElement?.containerId).toBe(rectangle.id);

    updateTextEditor(editor, "label");
    Keyboard.exitTextEditor(editor);

    const text = h.elements.find(
      (element) => element.type === "text",
    ) as ExcalidrawTextElement;
    expect(text.containerId).toBe(rectangle.id);
    expect(h.elements[0].boundElements).toEqual([
      { type: "text", id: text.id },
    ]);
    expect(h.state.activeTool.type).toBe("autoshape");
  });

  it("edits the existing bound text instead of creating another", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    // positioned at the container center, as bound text always is
    const boundText = API.createElement({
      type: "text",
      text: "ola",
      x: 190,
      y: 145,
      width: 20,
      height: 10,
      containerId: rectangle.id,
    });
    API.updateElement(rectangle, {
      boundElements: [{ type: "text", id: boundText.id }],
    });
    API.setElements([rectangle, boundText]);

    mouse.doubleClickAt(150, 130);

    await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(boundText.id);
    expect(h.elements).toHaveLength(2);
  });

  it("creates free text at the pointer on Alt+double-click inside a container", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([rectangle]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.doubleClickAt(140, 120);
    });

    await getTextEditor();
    expect(h.state.editingTextElement?.containerId ?? null).toBeNull();
  });

  it("deletes the text and unbinds on empty submit", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    API.setElements([rectangle]);

    mouse.doubleClickAt(150, 130);
    const editor = await getTextEditor();
    Keyboard.exitTextEditor(editor);

    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
    expect(h.elements[0].boundElements ?? []).toHaveLength(0);
    expect(h.state.activeTool.type).toBe("autoshape");
  });

  it("undo after submit removes only the text", async () => {
    sketch(rectanglePath(100, 100, 200, 120));
    expect(h.elements).toHaveLength(1);

    mouse.doubleClickAt(400, 400);
    const editor = await getTextEditor();
    updateTextEditor(editor, "note");
    Keyboard.exitTextEditor(editor);
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(2);

    Keyboard.undo();

    expect(
      h.elements.filter((element) => !element.isDeleted).map((el) => el.type),
    ).toEqual(["rectangle"]);
    expect(h.state.activeTool.type).toBe("autoshape");
  });

  it("allows to start a sketch on pointerdown while the editor is open", async () => {
    mouse.doubleClickAt(200, 200);
    await getTextEditor();
    const editor = await getTextEditor();
    updateTextEditor(editor, "note");

    mouse.downAt(400, 400);
    expect(h.app.drawShape.hasPendingGesture()).toBe(true);
    mouse.upAt(400, 500);

    // no shape got inserted by the click-away
    expect(
      h.elements.filter(
        (element) => element.type === "text" && !element.isDeleted,
      ),
    ).toHaveLength(1);
  });

  it("double-tap (touch) creates text through the same path", async () => {
    act(() => {
      // @ts-ignore private method — the touch double-tap detector funnels here
      h.app.handleCanvasDoubleClick({
        clientX: 200,
        clientY: 200,
        type: "touch",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    });

    expect(h.state.editingTextElement).not.toBeNull();
    expect(h.state.activeTool.type).toBe("autoshape");
  });
});

describe("autoshape tool activation", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("activates via its keyboard shortcut", () => {
    expect(h.state.activeTool.type).toBe("selection");

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.X);
    });

    expect(h.state.activeTool.type).toBe("autoshape");
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
        '[data-testid="toolbar-autoshape"]',
      )!,
    );

    expect(h.state.activeTool.type).toBe("autoshape");
  });
});

describe("autoshape compact toolbar placement", () => {
  it.each(["tablet", "phone"] as const)(
    "groups autoshape under freedraw on %s",
    async (formFactor) => {
      const { container } = await render(
        <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
      );
      fireEvent.resize(window);
      await waitFor(() =>
        expect(h.app.editorInterface.formFactor).toBe(formFactor),
      );

      const freedrawTrigger = container.querySelector(
        '[data-testid="toolbar-freedraw"]',
      )!;
      fireEvent.click(freedrawTrigger);

      const drawShapeOption = await waitFor(() => {
        const option = document.querySelector<HTMLButtonElement>(
          '.tool-popover-content [data-testid="toolbar-autoshape"]',
        );
        expect(option).not.toBeNull();
        return option!;
      });
      fireEvent.click(drawShapeOption);
      expect(h.state.activeTool.type).toBe("autoshape");
      expect(freedrawTrigger).toHaveAttribute("aria-pressed", "true");

      const extraToolsTrigger = container.querySelector(
        ".App-toolbar__extra-tools-trigger",
      )!;
      expect(extraToolsTrigger).not.toHaveClass(
        "App-toolbar__extra-tools-trigger--selected",
      );

      fireEvent.click(extraToolsTrigger);
      const extraTools = await waitFor(() => {
        const menu = document.querySelector(
          ".App-toolbar__extra-tools-dropdown",
        );
        expect(menu).not.toBeNull();
        return menu!;
      });
      expect(
        extraTools.querySelector('[data-testid="toolbar-autoshape"]'),
      ).not.toBeNull();
    },
  );
});
