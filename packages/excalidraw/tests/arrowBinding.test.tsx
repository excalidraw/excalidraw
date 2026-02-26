import { reseed } from "@excalidraw/common";
import { projectFixedPointOntoDiagonal } from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
} from "@excalidraw/element/types";

import { actionToggleArrowBinding } from "../actions/actionToggleArrowBinding";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
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
    it("arrow startBinding is set when binding is enabled", async () => {
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
      // End inside the target rectangle – binding off -> no endBinding
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
      API.executeAction(actionToggleArrowBinding); // true -> false
      API.executeAction(actionToggleArrowBinding); // false -> true
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
  // Arrow does snap to midpoint when isMidpointSnappingEnabled is true
  // -------------------------------------------------------------------------
  describe("Arrow doesn't snap to midpoint when midpoint snapping is disabled", () => {
    it("does not snap to midpoint when midpoint snapping is turned off", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "rectNoMidSnap",
        x: 100,
        y: 100,
        width: 400,
        height: 200,
      }) as ExcalidrawBindableElement;
      const arrow = API.createElement({
        type: "arrow",
        x: 0,
        y: 250,
        width: 502,
        height: -48,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(502, -48)],
      }) as ExcalidrawArrowElement;
      const elementsMap = new Map<string, ExcalidrawElement>([
        [rect.id, rect],
        [arrow.id, arrow],
      ]);
      const point = pointFrom<GlobalPoint>(502, 202);

      const snappedWithMidpoint = projectFixedPointOntoDiagonal(
        arrow,
        point,
        rect,
        "end",
        elementsMap,
        h.state.zoom,
        true,
      );
      const snappedWithoutMidpoint = projectFixedPointOntoDiagonal(
        arrow,
        point,
        rect,
        "end",
        elementsMap,
        h.state.zoom,
        false,
      );

      expect(snappedWithMidpoint).toEqual([500, 200]);
      expect(snappedWithoutMidpoint).not.toEqual([500, 200]);
    });
  });

  // -------------------------------------------------------------------------
  // Ctrl / Cmd key toggle
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

      ctrlKeyDown(); // capture true -> flip to false
      expect(h.state.isBindingEnabled).toBe(false);

      // A second keydown with Ctrl (e.g. pressing another key while Ctrl held)
      // should NOT re-capture and should leave state unchanged
      fireEvent.keyDown(document, {
        key: "z",
        ctrlKey: true,
        repeat: false,
      });
      // bindingEnabledBeforeCtrl is already captured
      expect(h.state.isBindingEnabled).toBe(false);

      // Ctrl keyup restores to captured value
      ctrlKeyUp();
      expect(h.state.isBindingEnabled).toBe(true);
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
