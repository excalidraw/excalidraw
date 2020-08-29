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

  it("rotation of arrow should rebind both ends", () => {
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
      x: 220,
      y: 250,
      width: 160,
      height: 1,
    });
    expect(arrow.startBinding?.elementId).toBe(rectLeft.id);
    expect(arrow.endBinding?.elementId).toBe(rectRight.id);

    const rotation = getTransformHandles(arrow, h.state.zoom, "mouse")
      .rotation!;
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
});
