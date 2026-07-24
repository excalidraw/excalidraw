import React from "react";

import { CLASSES } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, fireEvent, act, waitFor } from "./test-utils";

const { h } = window;

describe("frame name wheel", () => {
  it("wheel pans the canvas while editing a frame name", async () => {
    await render(<Excalidraw />);

    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    API.setElements([frame]);
    act(() => {
      API.setAppState({ editingFrame: frame.id });
    });

    // the rename <input> renders inside the .frame-name container
    let input: HTMLInputElement | null = null;
    await waitFor(() => {
      input = document.querySelector(`.${CLASSES.FRAME_NAME} input`);
      expect(input).not.toBeNull();
    });

    const scrollYBefore = h.state.scrollY;
    fireEvent.wheel(input!, { deltaX: 0, deltaY: 100 });

    // wheeling over the rename input should still pan the canvas
    expect(h.state.scrollY).not.toBe(scrollYBefore);
  });
});
