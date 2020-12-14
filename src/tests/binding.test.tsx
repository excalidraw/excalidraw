import React from "react";
import { render } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import { getTransformHandles } from "../element/transformHandles";
import { API } from "./helpers/api";
import { KEYS } from "../keys";

const { h } = window;

const mouse = new Pointer("mouse");

describe("element binding", () => {
  beforeEach(async () => {
    await render(<ExcalidrawApp />);
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
      x: 210,
      y: 250,
      width: 180,
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

      // Edit arrow with multi-point
      mouse.doubleClick();
      // move arrow head
      mouse.down();
      mouse.up(0, 10);
      expect(API.getSelectedElement().type).toBe("arrow");

      // NOTE this mouse down/up + await needs to be done in order to repro
      // the issue, due to https://github.com/excalidraw/excalidraw/blob/46bff3daceb602accf60c40a84610797260fca94/src/components/App.tsx#L740
      mouse.reset();
      expect(h.state.editingLinearElement).not.toBe(null);
      mouse.down(0, 0);
      await new Promise((r) => setTimeout(r, 100));
      expect(h.state.editingLinearElement).toBe(null);
      expect(API.getSelectedElement().type).toBe("rectangle");
      mouse.up();
      expect(API.getSelectedElement().type).toBe("rectangle");
    },
  );

  it("should bind/unbind arrow when moving it with keyboard", () => {
    const rectangle = UI.createElement("rectangle", {
      x: 75,
      y: 0,
      size: 100,
    });

    // Creates arrow 1px away from bidding with rectangle
    const arrow = UI.createElement("arrow", {
      x: 0,
      y: 0,
      size: 50,
    });

    expect(arrow.endBinding).toBe(null);

    expect(API.getSelectedElement().type).toBe("arrow");
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(arrow.endBinding?.elementId).toBe(rectangle.id);

    Keyboard.keyPress(KEYS.ARROW_LEFT);
    expect(arrow.endBinding).toBe(null);
  });
});
