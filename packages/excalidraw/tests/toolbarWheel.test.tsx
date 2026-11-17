import React from "react";
import { vi } from "vitest";

import { actionToggleWheelToolSwitching } from "../actions";
import {
  cleanAppStateForExport,
  clearAppStateForDatabase,
  clearAppStateForLocalStorage,
} from "../appState";
import { Excalidraw } from "../index";

import { UI, Pointer } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

import type { ToolType } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const getToolbar = () => document.querySelector<HTMLElement>(".App-toolbar")!;
const getToolButton = (type: string) =>
  document.querySelector<HTMLElement>(`[data-testid="toolbar-${type}"]`)!;

// wheel events carry their own timestamp, which decides whether they belong
// to the same flick of the wheel; tests advance it explicitly
let timeStamp = 0;

/**
 * Dispatches a wheel event over the toolbar (over the rectangle button by
 * default), `after` ms after the previous one — by default long enough to
 * start a fresh flick of the wheel.
 */
const wheel = (
  init: WheelEventInit,
  {
    after = 1000,
    target = getToolButton("rectangle"),
  }: { after?: number; target?: Element } = {},
) => {
  timeStamp += after;
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  fireEvent(target, event);
  return event;
};

const setActiveTool = (type: ToolType) => {
  act(() => {
    h.app.setActiveTool({ type });
  });
  expect(h.state.activeTool.type).toBe(type);
};

const renderEnabled = (props: React.ComponentProps<typeof Excalidraw> = {}) =>
  render(
    <Excalidraw
      {...props}
      initialData={{ appState: { isWheelToolSwitchingEnabled: true } }}
    />,
  );

describe("switching tools with the wheel over the toolbar", () => {
  beforeEach(() => {
    localStorage.clear();
    timeStamp = 0;
    mockBoundingClientRect({
      top: 0,
      left: 0,
      bottom: 1080,
      right: 1920,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    document.documentElement.dir = "";
  });

  describe("preference", () => {
    it("is off by default, leaving the wheel over the toolbar alone", async () => {
      await render(<Excalidraw />);
      expect(h.state.isWheelToolSwitchingEnabled).toBe(false);

      const event = wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("selection");
      expect(event.defaultPrevented).toBe(false);
    });

    it("is toggled by its action and kept in browser storage only", async () => {
      await render(<Excalidraw />);

      act(() => {
        h.app.actionManager.executeAction(actionToggleWheelToolSwitching);
      });
      expect(h.state.isWheelToolSwitchingEnabled).toBe(true);
      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("rectangle");

      // a user preference — not part of the scene
      expect(clearAppStateForLocalStorage(h.state)).toHaveProperty(
        "isWheelToolSwitchingEnabled",
        true,
      );
      expect(cleanAppStateForExport(h.state)).not.toHaveProperty(
        "isWheelToolSwitchingEnabled",
      );
      expect(clearAppStateForDatabase(h.state)).not.toHaveProperty(
        "isWheelToolSwitchingEnabled",
      );

      act(() => {
        h.app.actionManager.executeAction(actionToggleWheelToolSwitching);
      });
      expect(h.state.isWheelToolSwitchingEnabled).toBe(false);
      const event = wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("rectangle");
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe("stepping", () => {
    it("steps through the toolbar's tools in order, stopping at either end", async () => {
      await renderEnabled();
      setActiveTool("hand");

      const forward: string[] = [];
      for (let i = 0; i < 12; i++) {
        wheel({ deltaY: 100 });
        forward.push(h.state.activeTool.type);
      }
      expect(forward).toEqual([
        "selection",
        "rectangle",
        "diamond",
        "ellipse",
        "arrow",
        "line",
        "freedraw",
        "text",
        "stickynote",
        "eraser",
        // no wrapping around
        "eraser",
        "eraser",
      ]);

      const backward: string[] = [];
      for (let i = 0; i < 12; i++) {
        wheel({ deltaY: -100 });
        backward.push(h.state.activeTool.type);
      }
      expect(backward).toEqual([
        "stickynote",
        "text",
        "freedraw",
        "line",
        "arrow",
        "ellipse",
        "diamond",
        "rectangle",
        "selection",
        "hand",
        "hand",
        "hand",
      ]);
    });

    it("works from anywhere over the toolbar, and prevents scrolling the page", async () => {
      await renderEnabled();

      const event = wheel({ deltaY: 100 }, { target: getToolbar() });
      expect(h.state.activeTool.type).toBe("rectangle");
      expect(event.defaultPrevented).toBe(true);

      wheel(
        { deltaY: 100 },
        { target: document.querySelector(".ToolIcon__lock")! },
      );
      expect(h.state.activeTool.type).toBe("diamond");

      // stepping past the end still keeps the page from scrolling
      setActiveTool("eraser");
      expect(wheel({ deltaY: 100 }).defaultPrevented).toBe(true);
      expect(h.state.activeTool.type).toBe("eraser");
    });

    it("steps along the toolbar's layout on sideways input, also in RTL", async () => {
      await renderEnabled();
      setActiveTool("ellipse");

      wheel({ deltaX: 100 });
      expect(h.state.activeTool.type).toBe("arrow");
      wheel({ deltaX: -100 });
      expect(h.state.activeTool.type).toBe("ellipse");
      // the dominant axis wins
      wheel({ deltaX: -100, deltaY: 20 });
      expect(h.state.activeTool.type).toBe("diamond");

      // in RTL the toolbar is mirrored: swiping right goes towards its start
      getToolbar().style.direction = "rtl";
      wheel({ deltaX: 100 });
      expect(h.state.activeTool.type).toBe("rectangle");
      // vertical input keeps stepping forward on scrolling down
      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("diamond");
    });

    it("activates the preferred selection tool from its slot", async () => {
      await renderEnabled();
      act(() => {
        h.setState({
          preferredSelectionTool: { type: "lasso", initialized: true },
        });
      });
      // the toolbar shows the lasso button in place of the selection one
      expect(getToolButton("lasso")).not.toBe(null);

      setActiveTool("rectangle");
      wheel({ deltaY: -100 });
      expect(h.state.activeTool.type).toBe("lasso");
      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("rectangle");
    });

    it("treats tools of the extra tools dropdown as past the last button", async () => {
      await renderEnabled();

      setActiveTool("frame");
      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("frame");
      wheel({ deltaY: -100 });
      expect(h.state.activeTool.type).toBe("eraser");

      // the lasso, when it's not the preferred selection tool, is shown on
      // the extra tools trigger in the full toolbar
      setActiveTool("lasso");
      wheel({ deltaY: -100 });
      expect(h.state.activeTool.type).toBe("eraser");

      setActiveTool("autoshape");
      wheel({ deltaY: -100 });
      expect(h.state.activeTool.type).toBe("eraser");
    });

    it("follows the compact toolbar's popovers", async () => {
      await renderEnabled({ UIOptions: { getFormFactor: () => "tablet" } });
      fireEvent.resize(window);
      await waitFor(() =>
        expect(getToolbar().classList).toContain("App-toolbar--compact"),
      );

      // the selection popover holds the lasso
      setActiveTool("lasso");
      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("rectangle");

      // the freedraw popover holds the draw-shape tool
      setActiveTool("autoshape");
      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("text");
      setActiveTool("autoshape");
      wheel({ deltaY: -100 });
      expect(h.state.activeTool.type).toBe("line");
    });
  });

  describe("wheel input", () => {
    it("steps once per notch however small, and per 100px of continuous scroll", async () => {
      await renderEnabled();

      // a fresh flick steps right away, even a tiny one
      wheel({ deltaY: 4 });
      expect(h.state.activeTool.type).toBe("rectangle");

      // continuous input (trackpad) accumulates within the same flick
      wheel({ deltaY: 30 }, { after: 16 });
      wheel({ deltaY: 30 }, { after: 16 });
      wheel({ deltaY: 30 }, { after: 16 });
      expect(h.state.activeTool.type).toBe("rectangle");
      wheel({ deltaY: 30 }, { after: 16 });
      expect(h.state.activeTool.type).toBe("diamond");

      // quick notches of a mouse wheel step one each
      wheel({ deltaY: 100 }, { after: 30 });
      expect(h.state.activeTool.type).toBe("ellipse");
      wheel({ deltaY: 100 }, { after: 30 });
      expect(h.state.activeTool.type).toBe("arrow");
    });

    it("steps once per event at most, dropping the excess", async () => {
      await renderEnabled();

      wheel({ deltaY: 1000 });
      expect(h.state.activeTool.type).toBe("rectangle");
      wheel({ deltaY: 1000 }, { after: 16 });
      expect(h.state.activeTool.type).toBe("diamond");
      // nothing was banked from the large deltas
      wheel({ deltaY: 10 }, { after: 16 });
      expect(h.state.activeTool.type).toBe("diamond");
    });

    it("steps right away when reversing", async () => {
      await renderEnabled();

      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("rectangle");
      wheel({ deltaY: -4 }, { after: 16 });
      expect(h.state.activeTool.type).toBe("selection");
    });

    it("handles deltas delivered in lines", async () => {
      await renderEnabled();

      // one notch is usually 3 lines
      wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
      expect(h.state.activeTool.type).toBe("rectangle");
      wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE }, { after: 30 });
      expect(h.state.activeTool.type).toBe("diamond");
      wheel({ deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_LINE }, { after: 30 });
      expect(h.state.activeTool.type).toBe("diamond");
    });

    it("ignores ctrl/cmd+wheel (zoom and pinch gestures)", async () => {
      await renderEnabled();

      wheel({ deltaY: 100, ctrlKey: true });
      wheel({ deltaY: 100, metaKey: true });
      expect(h.state.activeTool.type).toBe("selection");
    });

    it("ignores the wheel while a button is pressed", async () => {
      await renderEnabled();

      const event = wheel({ deltaY: 100, buttons: 1 });
      expect(h.state.activeTool.type).toBe("selection");
      expect(event.defaultPrevented).toBe(false);
    });

    it("leaves the extra tools dropdown scrolling as usual", async () => {
      await renderEnabled();

      fireEvent.click(
        document.querySelector(".App-toolbar__extra-tools-trigger")!,
      );
      const dropdownItem = getToolButton("frame");
      expect(dropdownItem.closest(".dropdown-menu")).not.toBe(null);

      const event = wheel({ deltaY: 100 }, { target: dropdownItem });
      expect(h.state.activeTool.type).toBe("selection");
      expect(event.defaultPrevented).toBe(false);
    });

    it("leaves the wheel over the canvas panning", async () => {
      await renderEnabled();

      const { scrollY } = h.state;
      fireEvent.wheel(GlobalTestState.interactiveCanvas, { deltaY: 100 });
      expect(h.state.scrollY).not.toBe(scrollY);
      expect(h.state.activeTool.type).toBe("selection");
    });
  });

  describe("doesn't switch tools", () => {
    it("while editing text", async () => {
      await renderEnabled();

      UI.clickTool("text");
      mouse.clickAt(100, 100);
      expect(h.state.editingTextElement).not.toBe(null);
      const { activeTool } = h.state;

      wheel({ deltaY: 100 });
      expect(h.state.activeTool).toBe(activeTool);
      expect(h.state.editingTextElement).not.toBe(null);
    });

    it("while creating an element", async () => {
      await renderEnabled();

      // a click with the arrow tool starts a multi-point arrow
      UI.clickTool("arrow");
      mouse.clickAt(100, 100);
      mouse.moveTo(200, 200);
      expect(h.state.newElement).not.toBe(null);

      wheel({ deltaY: 100 });
      expect(h.state.activeTool.type).toBe("arrow");
      expect(h.state.newElement).not.toBe(null);
    });

    it("when the active tool is controlled by the host", async () => {
      const warn = vi.spyOn(console, "warn");
      await renderEnabled({ activeTool: { type: "rectangle" } });

      wheel({ deltaY: 100 });
      wheel({ deltaY: -100 });
      expect(h.state.activeTool.type).toBe("rectangle");
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("in view mode, where the toolbar is gone", async () => {
      await render(
        <Excalidraw
          initialData={{ appState: { isWheelToolSwitchingEnabled: true } }}
          viewModeEnabled
        />,
      );
      expect(document.querySelector(".App-toolbar")).toBe(null);
    });
  });
});
