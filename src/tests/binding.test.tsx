import React from "react";
import { render } from "./test-utils";
import App from "../components/App";
import { UI, Pointer } from "./helpers/ui";
import { getTransformHandles } from "../element/transformHandles";

const { h } = window;

const mouse = new Pointer("mouse");

describe("element binding", () => {
  beforeEach(() => {
    render(<App />);
  });

  // NOTE if this tests fails, skip it -- it was really flaky at one point
  it("rotation of arrow should rebind both ends", () => {
    const rect1 = UI.createElement("rectangle", {
      x: 0,
      width: 100,
      height: 1000,
    });
    const rect2 = UI.createElement("rectangle", {
      x: 200,
      width: 100,
      height: 1000,
    });
    const arrow = UI.createElement("arrow", {
      x: 110,
      y: 50,
      width: 80,
      height: 1,
    });
    expect(arrow.startBinding?.elementId).toBe(rect1.id);
    expect(arrow.endBinding?.elementId).toBe(rect2.id);

    const { rotation } = getTransformHandles(arrow, h.state.zoom, "mouse");
    if (rotation) {
      const rotationHandleX = rotation[0] + rotation[2] / 2;
      const rotationHandleY = rotation[1] + rotation[3] / 2;
      mouse.down(rotationHandleX, rotationHandleY);
      mouse.move(0, 1000);
      mouse.up();
    }
    expect(arrow.angle).toBeGreaterThan(3);
    expect(arrow.startBinding?.elementId).toBe(rect2.id);
    expect(arrow.endBinding?.elementId).toBe(rect1.id);
  });
});
