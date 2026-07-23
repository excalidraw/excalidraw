import React from "react";

import { ARROW_TYPE, KEYS } from "@excalidraw/common";

import { CURSOR_HINT_COOLDOWN } from "../components/CursorHint";
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
    // hints are only shown once the pointer position is known
    fireEvent.pointerMove(GlobalTestState.interactiveCanvas, {
      clientX: 100,
      clientY: 50,
    });
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

  it("shows hint when switching to the arrow tool via shortcut", () => {
    UI.clickTool("rectangle");

    pressKey(KEYS.A);

    expect(h.state.activeTool.type).toBe("arrow");
    expect(getCursorHint()).not.toBeNull();
  });

  it("shows hint when picking the line tool via shortcut", () => {
    pressKey(KEYS.L);

    expect(h.state.activeTool.type).toBe("line");
    expect(getCursorHint()).not.toBeNull();
  });

  it("shows hint when picking a tool via numeric shortcut", () => {
    pressKey("6");

    expect(h.state.activeTool.type).toBe("line");
    expect(getCursorHint()).not.toBeNull();
  });

  it("hides hint immediately on pointerdown", () => {
    UI.clickTool("arrow");

    pressKey(KEYS.A);
    expect(getCursorHint()).not.toBeNull();

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      clientX: 100,
      clientY: 100,
    });

    expect(getCursorHint()).toBeNull();

    // complete the gesture so no drag state leaks into other tests
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      clientX: 100,
      clientY: 100,
    });
  });

  it("does not show hint when picking a tool via toolbar", () => {
    UI.clickTool("arrow");

    expect(h.state.activeTool.type).toBe("arrow");
    expect(getCursorHint()).toBeNull();
  });

  describe("cooldown", () => {
    // dismiss outside the canvas so we don't start drawing an element
    // (which would block subsequent tool-switch shortcuts)
    const dismissHint = () => {
      fireEvent.pointerDown(document.body);
      expect(getCursorHint()).toBeNull();
    };

    const expireCooldown = () => {
      (h.app.cursorHints as any).lastShownAt =
        Date.now() - CURSOR_HINT_COOLDOWN;
    };

    it("suppresses tool-switch hint during cooldown", () => {
      pressKey(KEYS.A);
      expect(getCursorHint()).not.toBeNull();
      dismissHint();

      pressKey("v");
      pressKey(KEYS.A);

      expect(h.state.activeTool.type).toBe("arrow");
      expect(getCursorHint()).toBeNull();
    });

    it("shows tool-switch hint again once cooldown expires", () => {
      pressKey(KEYS.A);
      dismissHint();
      pressKey("v");

      expireCooldown();
      pressKey(KEYS.A);

      expect(getCursorHint()).not.toBeNull();
    });

    it("cycling arrow types bypasses cooldown", () => {
      pressKey(KEYS.A);
      dismissHint();

      // arrow tool already active -> cycles
      pressKey(KEYS.A);

      expect(getCursorHint()).not.toBeNull();
    });

    it("numeric shortcuts bypass cooldown", () => {
      pressKey(KEYS.A);
      dismissHint();
      pressKey("v");

      pressKey("6");
      expect(h.state.activeTool.type).toBe("line");
      expect(getCursorHint()).not.toBeNull();
      dismissHint();

      pressKey("v");
      pressKey("5");
      expect(h.state.activeTool.type).toBe("arrow");
      expect(getCursorHint()).not.toBeNull();
    });

    it("letter shortcut to another tool is also suppressed during cooldown", () => {
      pressKey(KEYS.A);
      dismissHint();

      pressKey(KEYS.L);

      expect(h.state.activeTool.type).toBe("line");
      expect(getCursorHint()).toBeNull();
    });
  });

  it("does not show hint when pointer position is unknown", () => {
    // simulate no pointermove having happened yet
    h.app.lastViewportPosition.x = 0;
    h.app.lastViewportPosition.y = 0;

    UI.clickTool("arrow");
    pressKey(KEYS.A);

    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
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
