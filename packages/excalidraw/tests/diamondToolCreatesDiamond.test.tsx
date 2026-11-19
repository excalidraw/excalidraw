import React from "react";

import { reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { render, fireEvent, unmountComponent } from "./test-utils";

unmountComponent();

beforeEach(() => {
  localStorage.clear();
  reseed(7);
});

const { h } = window;

describe("diamond tool", () => {
  it("drag-creating with the diamond tool creates a diamond, not an ellipse", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);

    fireEvent.click(getByToolName("diamond"));

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(canvas);

    expect(h.elements.length).toEqual(1);
    expect(h.elements[0].type).toEqual("diamond");
  });
});
