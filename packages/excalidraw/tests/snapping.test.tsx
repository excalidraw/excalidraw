import React from "react";
import { reseed } from "@excalidraw/common";
import "@excalidraw/utils/test-utils";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(() => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
});

const setupFrameWithChild = async () => {
  await render(<Excalidraw />);

  const frame = API.createElement({
    type: "frame",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  });
  const child = API.createElement({
    type: "rectangle",
    x: 50,
    y: 50,
    width: 40,
    height: 40,
    frameId: frame.id,
  });
  return { frame, child };
};

describe("object snapping", () => {
  it("doesn't snap a dragged frame to the original position of its children", async () => {
    const { frame, child } = await setupFrameWithChild();
    API.setElements([frame, child]);
    API.setSelectedElements([frame]);
    // snapping only considers elements inside the viewport
    act(() =>
      h.setState({ objectsSnapModeEnabled: true, width: 1000, height: 1000 }),
    );

    // move the frame's top-left corner to 3px from where the child started
    mouse.downAt(150, 150);
    mouse.moveTo(197, 197);

    expect(h.state.snapLines).toEqual([]);

    mouse.upAt(197, 197);

    expect([h.elements[0].x, h.elements[0].y]).toEqual([47, 47]);
    // the child moved along with the frame
    expect([h.elements[1].x, h.elements[1].y]).toEqual([97, 97]);
  });

  it("still snaps a dragged frame to other elements", async () => {
    const { frame, child } = await setupFrameWithChild();
    const other = API.createElement({
      type: "rectangle",
      x: 300,
      y: 300,
      width: 40,
      height: 40,
    });
    API.setElements([frame, child, other]);
    API.setSelectedElements([frame]);
    // snapping only considers elements inside the viewport
    act(() =>
      h.setState({ objectsSnapModeEnabled: true, width: 1000, height: 1000 }),
    );

    // move the frame's top-left corner to 3px from the other element's corner
    mouse.downAt(150, 150);
    mouse.moveTo(447, 447);

    expect(h.state.snapLines.length).toBeGreaterThan(0);

    mouse.upAt(447, 447);

    expect([h.elements[0].x, h.elements[0].y]).toEqual([300, 300]);
  });
});
