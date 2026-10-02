import { reseed } from "@excalidraw/common";

import type {
  BindMode,
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const orbitKeyDown = () =>
  fireEvent.keyDown(document, {
    key: "f",
    code: "KeyF",
  });

const orbitKeyUp = () =>
  fireEvent.keyUp(document, {
    key: "f",
    code: "KeyF",
  });

// ---------------------------------------------------------------------------

describe("Test orbitBindOverride", () => {
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

  describe("New arrow binding with orbit binding override enabled", () => {
    it("arrow inside binds when orbit binding is disabled", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect",
          x: 200,
          y: 200,
          width: 200,
          height: 200,
        }),
      ]);

      expect(h.state.isBindingEnabled).toBe(true);
      expect(h.state.orbitBindOverrideEnabled).toBe(false);

      UI.clickTool("arrow");
      // Arrow ends inside the rectangle
      mouse.downAt(100, 100);
      mouse.moveTo(300, 300);
      mouse.up();

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).not.toBeNull();
        expect(arrow!.endBinding!.mode).toBeTruthy();
        expect(arrow!.endBinding!.mode).toBe<BindMode>("inside");
      });
    });

    it("arrow orbit binds when orbit binding is enabled", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect",
          x: 200,
          y: 200,
          width: 200,
          height: 200,
        }),
      ]);

      API.setAppState({
        orbitBindOverrideEnabled: true,
      });

      expect(h.state.isBindingEnabled).toBe(true);
      expect(h.state.orbitBindOverrideEnabled).toBe(true);

      UI.clickTool("arrow");
      // Arrow ends inside the rectangle
      mouse.downAt(100, 100);
      mouse.moveTo(300, 300);
      mouse.up();

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).not.toBeNull();
        expect(arrow!.endBinding!.mode).toBeTruthy();
        expect(arrow!.endBinding!.mode).toBe<BindMode>("orbit");
      });
    });

    it("orbit binding is enabled when orbit key is pressed", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect",
          x: 200,
          y: 200,
          width: 200,
          height: 200,
        }),
      ]);

      UI.clickTool("arrow");

      mouse.clickAt(100, 100);
      mouse.moveTo(150, 150);

      orbitKeyDown();
      expect(h.state.orbitBindOverrideEnabled).toBe(true);
    });

    it("orbit binding is disabled when orbit key is released", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect",
          x: 200,
          y: 200,
          width: 200,
          height: 200,
        }),
      ]);

      UI.clickTool("arrow");

      mouse.clickAt(100, 100);
      mouse.moveTo(150, 150);

      orbitKeyDown();
      expect(h.state.orbitBindOverrideEnabled).toBe(true);

      orbitKeyUp();
      expect(h.state.orbitBindOverrideEnabled).toBe(false);
    });
  });

  describe("Existing arrow binding when dragged with orbit override", async () => {
    it("Arrow end dragged with orbit binding disabled", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect",
          x: 200,
          y: 200,
          width: 200,
          height: 200,
        }),
      ]);
      UI.clickTool("arrow");
      // Arrow ends outside the rectangle
      mouse.downAt(100, 100);
      mouse.upAt(600, 600);

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).toBeNull();
        expect(h.state.selectedLinearElement).not.toBeNull();
      });

      mouse.downAt(600, 600);
      mouse.moveTo(300, 300);
      mouse.up();

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).not.toBeNull();
        expect(arrow!.endBinding!.mode).toBeTruthy();
        expect(arrow!.endBinding!.mode).toBe<BindMode>("inside");
      });
    });
    it("Arrow end dragged with orbit binding enabled", async () => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          id: "rect",
          x: 200,
          y: 200,
          width: 200,
          height: 200,
        }),
      ]);
      UI.clickTool("arrow");
      // Arrow ends outside the rectangle
      mouse.downAt(100, 100);
      mouse.upAt(600, 600);

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).toBeNull();
        expect(h.state.selectedLinearElement).not.toBeNull();
      });

      mouse.downAt(600, 600);
      mouse.moveTo(300, 300);

      orbitKeyDown();
      expect(h.state.orbitBindOverrideEnabled).toBe(true);

      mouse.up();

      await waitFor(() => {
        const arrow = h.elements.find(
          (el): el is ExcalidrawArrowElement => el.type === "arrow",
        );
        expect(arrow).toBeDefined();
        expect(arrow!.endBinding).not.toBeNull();
        expect(arrow!.endBinding!.mode).toBeTruthy();
        expect(arrow!.endBinding!.mode).toBe<BindMode>("orbit");
      });
    });
  });
});
