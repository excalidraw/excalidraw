import React from "react";

import { ARROW_TYPE, KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard, UI } from "./helpers/ui";
import {
  GlobalTestState,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const getCursorHint = () =>
  document.querySelector<HTMLElement>("[data-testid='cursor-hint']");

// dispatch on the canvas so the event propagates to the container's
// keydown handler (`handleKeyboardGlobally` is disabled by default)
const pressKey = (key: string) => {
  Keyboard.keyPress(key, GlobalTestState.interactiveCanvas);
};

describe("cursor hint", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("shows hint when cycling arrow types via shortcut, and auto-hides it", async () => {
    UI.clickTool("arrow");
    expect(getCursorHint()).toBeNull();

    // default arrow type is `round`, so cycling continues to `elbow`
    pressKey(KEYS.A);

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
    expect(getCursorHint()).not.toBeNull();
    expect(getCursorHint()!.querySelector("svg")).not.toBeNull();

    pressKey(KEYS.A);

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.sharp);
    expect(getCursorHint()).not.toBeNull();

    await waitFor(() => {
      expect(getCursorHint()).toBeNull();
    });
  });

  it("does not show hint when merely switching to the arrow tool", () => {
    UI.clickTool("rectangle");

    pressKey(KEYS.A);

    expect(h.state.activeTool.type).toBe("arrow");
    expect(getCursorHint()).toBeNull();
  });

  it("tracks pointer position while visible", () => {
    mockBoundingClientRect({ width: 1920, height: 1080 });

    try {
      UI.clickTool("arrow");
      pressKey(KEYS.A);

      fireEvent.pointerMove(window, { clientX: 200, clientY: 100 });

      // 16px offset from the pointer
      expect(getCursorHint()!.style.transform).toBe("translate(216px, 116px)");
    } finally {
      restoreOriginalGetBoundingClientRect();
    }
  });
});
