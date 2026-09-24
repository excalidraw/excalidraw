import React from "react";

import { Excalidraw } from "../index";

import { serializeAsJSON } from "../data/json";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const { h } = window;

describe("UIOptions.canvasHandleScale", () => {
  it.each([
    [undefined, 1],
    [0, 1],
    [1.5, 1.5],
    [3, 2],
    [NaN, 1],
    [Infinity, 1],
  ])("normalizes %s to %s", async (value, expected) => {
    await render(<Excalidraw UIOptions={{ canvasHandleScale: value }} />);
    expect(h.app.props.UIOptions.canvasHandleScale).toBe(expected);
  });

  it("keeps the setting local to each mounted editor", async () => {
    await render(<Excalidraw UIOptions={{ canvasHandleScale: 2 }} />);
    const firstEditor = h.app;
    await render(<Excalidraw />);
    expect(firstEditor.props.UIOptions.canvasHandleScale).toBe(2);
    expect(h.app.props.UIOptions.canvasHandleScale).toBe(1);
  });

  it("updates independently of the document and supports dragging the enlarged edge", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    });
    const { rerender } = await render(
      <Excalidraw
        initialData={{
          elements: [rectangle],
          appState: { selectedElementIds: { [rectangle.id]: true } },
        }}
      />,
    );
    const before = serializeAsJSON(h.elements, h.state, {}, "local");
    act(() => {
      rerender(<Excalidraw UIOptions={{ canvasHandleScale: 2 }} />);
    });
    expect(h.app.props.UIOptions.canvasHandleScale).toBe(2);
    expect(serializeAsJSON(h.elements, h.state, {}, "local")).toBe(before);

    // Rectangle ends at (400, 300); the handle center is offset by 4px.
    // Seven more pixels reaches the enlarged target outside the old 8px box.
    const x = 411;
    const y = 311;
    const mouse = new Pointer("mouse");
    mouse.downAt(x, y);
    mouse.moveTo(x + 40, y + 30);
    mouse.upAt(x + 40, y + 30);
    expect(h.elements[0].width).toBeGreaterThan(300);
    expect(h.elements[0].height).toBeGreaterThan(200);
  });
});
