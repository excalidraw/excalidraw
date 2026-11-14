import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import * as InteractiveScene from "../renderer/interactiveScene";
import * as NewElementScene from "../renderer/renderNewElementScene";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { AppState } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
const renderNewElementScene = vi.spyOn(
  NewElementScene,
  "renderNewElementScene",
);
const renderInteractiveScene = vi.spyOn(
  InteractiveScene,
  "renderInteractiveScene",
);

const MOVES = 10;

/** drags out a new linear element from (x, y), returns the scene renders
 * during the pointer moves */
const drawLinear = (
  tool: "arrow" | "line",
  x: number,
  y: number,
  arrowType: AppState["currentItemArrowType"] = "round",
) => {
  UI.clickTool(tool);
  API.setAppState({ currentItemArrowType: arrowType });
  mouse.reset();
  mouse.down(x, y);
  renderStaticScene.mockClear();
  renderNewElementScene.mockClear();
  renderInteractiveScene.mockClear();
  for (let i = 0; i < MOVES; i++) {
    mouse.move(10, 6);
  }
  const renders = {
    static: renderStaticScene.mock.calls.length,
    newElement: renderNewElementScene.mock.calls.length,
    interactive: renderInteractiveScene.mock.calls.length,
  };
  mouse.up();
  return renders;
};

const getNewLinear = () =>
  h.elements.find(
    (element) => element.type === "arrow" || element.type === "line",
  ) as ExcalidrawArrowElement;

const expectToFollowPointer = (x: number, y: number) => {
  const element = getNewLinear();
  const [lastX, lastY] = element.points[element.points.length - 1];
  expect(element.x + lastX).toBeCloseTo(x + MOVES * 10);
  expect(element.y + lastY).toBeCloseTo(y + MOVES * 6);
};

describe("creating a linear element", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setElements([
      API.createElement({
        type: "frame",
        id: "frame",
        x: 0,
        y: 0,
        width: 300,
        height: 300,
      }),
    ]);
    // jsdom has no layout, give the viewport a size so nothing gets culled
    API.setAppState({ width: 1000, height: 1000 });
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it.each([
    ["arrow", "round"],
    ["arrow", "elbow"],
    ["line", "round"],
  ] as const)(
    "redraws a new %s (%s) without re-rendering the static scene",
    (tool, arrowType) => {
      const renders = drawLinear(tool, 500, 50, arrowType);

      expect(renders.static).toBe(0);
      // the element itself, and its point handles, are redrawn on every move
      expect(renders.newElement).toBeGreaterThanOrEqual(MOVES);
      expect(renders.interactive).toBeGreaterThanOrEqual(MOVES);

      expect(getNewLinear().type).toBe(tool);
      expectToFollowPointer(500, 50);
    },
  );

  it.each([
    ["arrow", "round"],
    ["arrow", "elbow"],
    ["line", "round"],
  ] as const)("redraws a new %s (%s) inside a frame", (tool, arrowType) => {
    const renders = drawLinear(tool, 50, 50, arrowType);

    // drawn on whichever canvas holds it, on every move
    expect(Math.max(renders.static, renders.newElement)).toBeGreaterThanOrEqual(
      MOVES,
    );

    expect(getNewLinear().frameId).toBe("frame");
    expectToFollowPointer(50, 50);
  });

  it.each(["arrow", "line"] as const)(
    "redraws a new multi-point %s without re-rendering the static scene",
    (tool) => {
      UI.clickTool(tool);
      mouse.reset();
      // click (not drag) to start a multi-point element
      mouse.clickAt(500, 50);
      expect(h.state.multiElement).not.toBeNull();
      // leave the commit zone to create the uncommitted last point
      mouse.move(10, 6);
      renderStaticScene.mockClear();
      renderNewElementScene.mockClear();
      renderInteractiveScene.mockClear();
      for (let i = 1; i < MOVES; i++) {
        mouse.move(10, 6);
      }
      expect(renderStaticScene.mock.calls.length).toBe(0);
      expect(renderNewElementScene.mock.calls.length).toBeGreaterThanOrEqual(
        MOVES - 1,
      );
      expect(renderInteractiveScene.mock.calls.length).toBeGreaterThanOrEqual(
        MOVES - 1,
      );
      expectToFollowPointer(500, 50);
      Keyboard.keyPress(KEYS.ESCAPE);
    },
  );

  it("still binds a new arrow", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 600,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    UI.clickTool("arrow");
    mouse.reset();
    mouse.down(450, 50);
    renderStaticScene.mockClear();
    for (let i = 0; i < 10; i++) {
      mouse.move(20, 0);
    }
    expect(h.state.suggestedBinding?.element.id).toBe(rectangle.id);
    // the binding highlight is drawn on the interactive canvas only
    expect(renderStaticScene.mock.calls.length).toBe(0);
    mouse.up();

    const arrow = getNewLinear();
    expect(arrow.endBinding?.elementId).toBe(rectangle.id);
    expect(
      h.elements.find((element) => element.id === rectangle.id)!.boundElements,
    ).toEqual([{ id: arrow.id, type: "arrow" }]);
  });

  it("re-renders the static scene when dragging a point of an existing arrow", () => {
    const arrow = UI.createElement("arrow", { x: 500, y: 50, size: 100 });
    // enter the point editor and drag the end point
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ENTER);
    });
    expect(h.state.selectedLinearElement?.isEditing).toBe(true);

    const [endX, endY] = arrow.points[arrow.points.length - 1];
    mouse.reset();
    mouse.downAt(arrow.x + endX, arrow.y + endY);
    renderStaticScene.mockClear();
    for (let i = 0; i < 5; i++) {
      mouse.move(10, 0);
    }
    expect(renderStaticScene.mock.calls.length).toBeGreaterThanOrEqual(5);
    mouse.up();
  });
});
