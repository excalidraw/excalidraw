import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard, Pointer } from "./helpers/ui";
import { act, GlobalTestState, render } from "./test-utils";

const { h } = window;

describe("shape tool deactivation hint", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("shows a hint after Escape deactivates a drawing shape tool", () => {
    act(() => {
      h.app.setActiveTool({ type: "rectangle" });
    });

    Keyboard.keyPress(KEYS.ESCAPE);

    expect(h.state.activeTool.type).toBe("selection");
    expect(h.state.shapeToolExitedViaEscape).toBe(true);

    const hint = GlobalTestState.renderResult.container.querySelector(
      ".HintViewer",
    );
    expect(hint?.textContent).toContain("Drawing tool deactivated");
  });

  it("clears the hint after re-selecting a drawing shape tool", () => {
    act(() => {
      h.app.setActiveTool({ type: "ellipse" });
    });

    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.state.shapeToolExitedViaEscape).toBe(true);

    act(() => {
      h.app.setActiveTool({ type: "arrow" });
    });

    expect(h.state.shapeToolExitedViaEscape).toBe(false);
  });

  it("does not set the hint when Escape clears a selection", () => {
    act(() => {
      h.app.setActiveTool({ type: "rectangle" });
    });

    const mouse = new Pointer("mouse");
    mouse.down(10, 10);
    mouse.up(50, 50);

    expect(h.state.selectedElementIds).toEqual(
      expect.objectContaining({
        [h.elements[0].id]: true,
      }),
    );

    Keyboard.keyPress(KEYS.ESCAPE);

    expect(h.state.shapeToolExitedViaEscape).toBe(false);
  });
});
