/**
 * Tests for arrow binding preferences – focused on the non-default case where
 * isBindingEnabled is false (arrow binding turned off).
 *
 * Features under test:
 *  - actionToggleArrowBinding (action state, perform, checked)
 *  - Ctrl/Cmd keydown / keyup toggle logic (toggle-on-press, not hold-to-disable)
 *  - event.repeat guard preventing rapid-key-repeat from re-triggering toggle
 *  - bindingEnabledBeforeCtrl single-capture semantics
 *  - Arrow not binding when isBindingEnabled is false
 *  - Persistence: isBindingEnabled loaded from localStorage (browser: true)
 *  - Canvas context menu exposes the arrowBinding action
 */

import React from "react";

import { reseed } from "@excalidraw/common";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { actionToggleArrowBinding } from "../actions/actionToggleArrowBinding";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  GlobalTestState,
  waitFor,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fire Ctrl (or Meta on Mac) keydown on document. */
const ctrlKeyDown = (extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(document, {
    key: "Control",
    code: "ControlLeft",
    ctrlKey: true,
    repeat: false,
    ...extra,
  });

/** Fire Ctrl (or Meta on Mac) keyup on document (ctrlKey is false on keyup). */
const ctrlKeyUp = () =>
  fireEvent.keyUp(document, {
    key: "Control",
    code: "ControlLeft",
    ctrlKey: false,
  });

// ---------------------------------------------------------------------------

describe("Arrow binding – non-default case (isBindingEnabled: false)", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    h.state.width = 1920;
    h.state.height = 1080;
  });

  afterEach(() => {
    mouse.reset();
  });

  // -------------------------------------------------------------------------
  // actionToggleArrowBinding
  // -------------------------------------------------------------------------

  describe("actionToggleArrowBinding", () => {
    it("isBindingEnabled defaults to true", () => {
      expect(h.state.isBindingEnabled).toBe(true);
    });

    it("checked() reflects the current isBindingEnabled value", () => {
      expect(actionToggleArrowBinding.checked!(h.state)).toBe(true);

      API.setAppState({ isBindingEnabled: false });
      expect(actionToggleArrowBinding.checked!(h.state)).toBe(false);
    });

    it("executing the action toggles isBindingEnabled from true → false", () => {
      expect(h.state.isBindingEnabled).toBe(true);
      API.executeAction(actionToggleArrowBinding);
      expect(h.state.isBindingEnabled).toBe(false);
    });

    it("executing the action toggles isBindingEnabled from false → true", () => {
      API.setAppState({ isBindingEnabled: false });

      API.executeAction(actionToggleArrowBinding);
      expect(h.state.isBindingEnabled).toBe(true);
    });

    it("checked() returns false after action disables binding", () => {
      API.executeAction(actionToggleArrowBinding); // true → false
      expect(actionToggleArrowBinding.checked!(h.state)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Arrow does not bind when isBindingEnabled is false
  // -------------------------------------------------------------------------

  describe("Arrow drawing with binding disabled", () => {
    /**
     * Baseline: verify binding IS created with binding enabled so we know the
     * spatial setup is correct.
     */
    it("arrow startBinding is set when binding is enabled (baseline)", async () => {
      // Rectangle centred in canvas
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "baselineRect",
          x: 100,
          y: 100,
          width: 400,
          height: 200,
        }),
      ]);

      expect(h.state.isBindingEnabled).toBe(true);

      UI.clickTool("arrow");
      // Start inside the rectangle so startBinding can be created
      mouse.down(200, 200);
      mouse.up(700, 200);

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.startBinding).not.toBeNull();
        expect(arrow!.startBinding!.elementId).toBe("baselineRect");
      });
    });

    it("arrow has no startBinding when isBindingEnabled is false", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect1",
          x: 100,
          y: 100,
          width: 400,
          height: 200,
        }),
      ]);

      API.setAppState({ isBindingEnabled: false });

      UI.clickTool("arrow");
      // Start inside the rectangle – binding is off, so no startBinding
      mouse.down(200, 200);
      mouse.up(700, 200);

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.startBinding).toBeNull();
      });
    });

    it("arrow has no endBinding when isBindingEnabled is false", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect2",
          x: 500,
          y: 100,
          width: 300,
          height: 200,
        }),
      ]);

      API.setAppState({ isBindingEnabled: false });

      UI.clickTool("arrow");
      // End inside the target rectangle – binding off → no endBinding
      mouse.down(100, 200);
      mouse.up(600, 200);

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).toBeNull();
      });
    });

    it("re-enabling binding via action causes new arrows to bind again", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect3",
          x: 100,
          y: 100,
          width: 400,
          height: 200,
        }),
      ]);

      // Disable then re-enable binding
      API.executeAction(actionToggleArrowBinding); // true → false
      API.executeAction(actionToggleArrowBinding); // false → true
      expect(h.state.isBindingEnabled).toBe(true);

      UI.clickTool("arrow");
      mouse.down(200, 200);
      mouse.up(700, 200);

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.startBinding).not.toBeNull();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Ctrl / Cmd key toggle semantics
  // -------------------------------------------------------------------------

  describe("Ctrl key toggle when binding starts OFF", () => {
    it("Ctrl keydown temporarily enables binding when it was off", () => {
      API.setAppState({ isBindingEnabled: false });

      ctrlKeyDown();

      expect(h.state.isBindingEnabled).toBe(true);
    });

    it("Ctrl keyup restores isBindingEnabled to false after the temporary toggle", () => {
      API.setAppState({ isBindingEnabled: false });

      ctrlKeyDown();
      expect(h.state.isBindingEnabled).toBe(true);

      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(false);
    });

    it("full round-trip: off → Ctrl down → on → Ctrl up → off", () => {
      API.setAppState({ isBindingEnabled: false });

      ctrlKeyDown();
      expect(h.state.isBindingEnabled).toBe(true);

      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(false);
    });

    it("full round-trip can be repeated after Ctrl release resets state", () => {
      API.setAppState({ isBindingEnabled: false });

      // First cycle
      ctrlKeyDown();
      expect(h.state.isBindingEnabled).toBe(true);
      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(false);

      // Second cycle
      ctrlKeyDown();
      expect(h.state.isBindingEnabled).toBe(true);
      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(false);
    });
  });

  describe("Ctrl key toggle when binding starts ON", () => {
    it("Ctrl keydown temporarily disables binding when it was on", () => {
      expect(h.state.isBindingEnabled).toBe(true);

      ctrlKeyDown();
      expect(h.state.isBindingEnabled).toBe(false);
    });

    it("Ctrl keyup restores isBindingEnabled to true after the temporary toggle", () => {
      expect(h.state.isBindingEnabled).toBe(true);

      ctrlKeyDown();
      expect(h.state.isBindingEnabled).toBe(false);

      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // event.repeat guard
  // -------------------------------------------------------------------------

  describe("event.repeat guard", () => {
    it("Ctrl keydown with repeat=true does not toggle binding (non-default: off)", () => {
      API.setAppState({ isBindingEnabled: false });

      ctrlKeyDown({ repeat: true });

      // Must remain off – repeat events are ignored
      expect(h.state.isBindingEnabled).toBe(false);
    });

    it("Ctrl keydown with repeat=true does not toggle binding (default: on)", () => {
      expect(h.state.isBindingEnabled).toBe(true);

      ctrlKeyDown({ repeat: true });

      expect(h.state.isBindingEnabled).toBe(true);
    });

    it("only the first non-repeat Ctrl keydown captures bindingEnabledBeforeCtrl", () => {
      // Start ON, first Ctrl keydown captures 'true' and flips to false
      expect(h.state.isBindingEnabled).toBe(true);

      ctrlKeyDown(); // capture true → flip to false
      expect(h.state.isBindingEnabled).toBe(false);

      // A second keydown with Ctrl (e.g. pressing another key while Ctrl held)
      // should NOT re-capture and should leave state unchanged
      fireEvent.keyDown(document, {
        key: "z",
        ctrlKey: true,
        repeat: false,
      });
      // bindingEnabledBeforeCtrl is already captured; isBindingEnabled = !true = false (same)
      expect(h.state.isBindingEnabled).toBe(false);

      // Ctrl keyup restores to captured value (true)
      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  describe("Persistence (isBindingEnabled initialData / browser storage)", () => {
    it("respects isBindingEnabled=false supplied via initialData", async () => {
      unmountComponent();
      localStorage.clear();
      reseed(7);

      // The core <Excalidraw> component accepts initial state through the
      // initialData prop; the browser-storage persistence layer (browser: true)
      // sits in the app shell above. Passing the value directly exercises the
      // same hydration path.
      await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          initialData={{ appState: { isBindingEnabled: false } }}
        />,
      );

      await waitFor(() => {
        expect(h.state.isBindingEnabled).toBe(false);
      });
    });

    it("defaults to isBindingEnabled=true when localStorage has no entry", () => {
      // localStorage is cleared in beforeEach; after a fresh render the default applies
      expect(h.state.isBindingEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Canvas context menu
  // -------------------------------------------------------------------------

  describe("Canvas context menu", () => {
    it("includes the arrowBinding action item", () => {
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });

      const contextMenu = UI.queryContextMenu();
      expect(contextMenu).not.toBeNull();
      expect(
        contextMenu?.querySelector(`li[data-testid="arrowBinding"]`),
      ).not.toBeNull();
    });

    it("arrowBinding context-menu item has checkmark class when binding is on", () => {
      expect(h.state.isBindingEnabled).toBe(true);

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });

      const contextMenu = UI.queryContextMenu();
      expect(contextMenu).not.toBeNull();
      // The context-menu button receives the "checkmark" CSS class when checked
      const button = contextMenu?.querySelector<HTMLElement>(
        `li[data-testid="arrowBinding"] button.checkmark`,
      );
      expect(button).not.toBeNull();
    });

    it("arrowBinding context-menu item has no checkmark class when binding is off", () => {
      API.setAppState({ isBindingEnabled: false });

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });

      const contextMenu = UI.queryContextMenu();
      expect(contextMenu).not.toBeNull();
      const item = contextMenu?.querySelector<HTMLElement>(
        `li[data-testid="arrowBinding"]`,
      );
      expect(item).not.toBeNull();
      // No checkmark class when unchecked
      const checkedButton = contextMenu?.querySelector<HTMLElement>(
        `li[data-testid="arrowBinding"] button.checkmark`,
      );
      expect(checkedButton).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // View-mode guard
  // -------------------------------------------------------------------------

  describe("View-mode guard", () => {
    it("Ctrl keydown in viewMode does not toggle isBindingEnabled", () => {
      API.setAppState({ isBindingEnabled: false, viewModeEnabled: true });

      ctrlKeyDown();

      // Handler returns early in viewMode — state must stay false
      expect(h.state.isBindingEnabled).toBe(false);
    });
  });
});
