import { vi } from "vitest";

import { Excalidraw } from "../index";

import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

/** draws a freedraw stroke starting at (x, y) and returns the number of static
 *  scene renders that happened while the stroke was being drawn */
const drawStroke = (x: number, y: number) => {
  UI.clickTool("freedraw");
  mouse.reset();
  mouse.down(x, y);
  renderStaticScene.mockClear();
  for (let i = 0; i < 10; i++) {
    mouse.move(5, 3);
  }
  const renders = renderStaticScene.mock.calls.length;
  mouse.up();
  return renders;
};

describe("freedraw inside a frame", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    API.setElements([
      API.createElement({
        type: "frame",
        id: "frame",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      }),
    ]);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("doesn't re-render the static scene on each pointer move", () => {
    const rendersOutsideFrame = drawStroke(300, 300);
    const rendersInsideFrame = drawStroke(50, 50);

    expect(rendersInsideFrame).toBe(rendersOutsideFrame);

    // the stroke drawn inside the frame is still added to it
    expect(
      h.elements.filter(
        (element) => element.type === "freedraw" && element.frameId === "frame",
      ),
    ).toHaveLength(1);
  });
});
