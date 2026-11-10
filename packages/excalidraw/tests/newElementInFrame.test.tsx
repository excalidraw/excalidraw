import { vi } from "vitest";

import { Excalidraw } from "../index";

import * as NewElementScene from "../renderer/renderNewElementScene";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { ToolType } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
const renderNewElementScene = vi.spyOn(
  NewElementScene,
  "renderNewElementScene",
);

const lastStaticIds = () =>
  renderStaticScene.mock.lastCall![0].visibleElements.map(
    (element) => element.id,
  );
const lastCoveringIds = () =>
  (renderNewElementScene.mock.lastCall![0].coveringElements ?? []).map(
    (element) => element.id,
  );

/** drags a new element of `tool` from (x, y) and keeps the pointer down */
const startDrawing = (tool: ToolType, x: number, y: number) => {
  UI.clickTool(tool);
  mouse.reset();
  mouse.down(x, y);
};

describe("new element inside a frame", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    API.setElements([
      API.createElement({
        type: "rectangle",
        id: "child",
        frameId: "frame",
        x: 20,
        y: 20,
        width: 50,
        height: 50,
      }),
      API.createElement({
        type: "frame",
        id: "frame",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      }),
      // above the frame in z-order, overlapping it, not in it
      API.createElement({
        type: "rectangle",
        id: "covering",
        x: 150,
        y: 150,
        width: 100,
        height: 100,
      }),
      // above the frame in z-order, not overlapping it
      API.createElement({
        type: "rectangle",
        id: "elsewhere",
        x: 600,
        y: 600,
        width: 50,
        height: 50,
      }),
    ]);
    // jsdom has no layout, give the viewport a size so nothing gets culled
    API.setAppState({ width: 1000, height: 1000 });
    renderStaticScene.mockClear();
    renderNewElementScene.mockClear();
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it.each<ToolType>(["freedraw", "rectangle", "ellipse"])(
    "doesn't re-render the static scene while sizing a new %s",
    (tool) => {
      startDrawing(tool, 50, 50);
      renderStaticScene.mockClear();
      for (let i = 0; i < 10; i++) {
        mouse.move(5, 3);
      }
      expect(renderStaticScene).not.toHaveBeenCalled();
      expect(renderNewElementScene.mock.calls.length).toBeGreaterThanOrEqual(
        10,
      );
      mouse.up();

      const [newElement] = h.elements.filter(
        (element) =>
          !["child", "frame", "covering", "elsewhere"].includes(element.id),
      );
      expect(newElement.frameId).toBe("frame");
      // above the frame's children, below the frame
      expect(h.elements.map((element) => element.id)).toEqual([
        "child",
        newElement.id,
        "frame",
        "covering",
        "elsewhere",
      ]);
    },
  );

  it("draws the elements covering the frame on top of the new element", () => {
    startDrawing("freedraw", 50, 50);
    mouse.move(10, 10);

    // the frame (its outline) and the overlapping rectangle
    expect(lastCoveringIds()).toEqual(["frame", "covering"]);
    expect(lastStaticIds()).toEqual(["child", "elsewhere"]);

    mouse.up();

    const newElement = h.elements[1];
    expect(lastStaticIds()).toEqual([
      "child",
      newElement.id,
      "frame",
      "covering",
      "elsewhere",
    ]);
  });

  it("doesn't split the layers for a new element outside of frames", () => {
    startDrawing("freedraw", 400, 400);
    mouse.move(10, 10);

    expect(lastCoveringIds()).toEqual([]);
    expect(lastStaticIds()).toEqual([
      "child",
      "frame",
      "covering",
      "elsewhere",
    ]);

    mouse.up();
  });

  it("re-splits the layers when the scene changes mid-stroke", () => {
    startDrawing("freedraw", 50, 50);
    mouse.move(10, 10);
    expect(lastCoveringIds()).toEqual(["frame", "covering"]);

    // e.g. a collaborator drops an element over the frame
    act(() => {
      API.updateScene({
        elements: [
          ...h.elements,
          API.createElement({
            type: "ellipse",
            id: "remote",
            x: 10,
            y: 100,
            width: 50,
            height: 50,
          }),
        ],
      });
    });
    mouse.move(10, 10);

    expect(lastCoveringIds()).toEqual(["frame", "covering", "remote"]);
    expect(lastStaticIds()).toEqual(["child", "elsewhere"]);

    mouse.up();
  });
});
