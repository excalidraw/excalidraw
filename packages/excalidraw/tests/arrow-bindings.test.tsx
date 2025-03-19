import { vi } from "vitest";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { GlobalTestState, render, unmountComponent } from "./test-utils";

import type {
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
} from "../element/types";
import type { NormalizedZoomValue } from "../types";

const { h } = window;
const mouse = new Pointer("mouse");

describe("arrow bindings", () => {
  beforeEach(async () => {
    unmountComponent();

    mouse.reset();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);
    API.setAppState({
      zoom: {
        value: 1 as NormalizedZoomValue,
      },
    });
  });

  it("should preserve arrow bindings after undo/redo", async () => {
    const rect = UI.createElement("rectangle", {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    mouse.downAt(50, 150);
    mouse.moveTo(100, 150);
    mouse.up();

    const arrow = h.elements[1] as ExcalidrawLinearElement;

    expect(arrow.endBinding).toEqual(
      expect.objectContaining({
        elementId: rect.id,
        focus: expect.any(Number),
        gap: expect.any(Number),
      }),
    );

    expect(rect.boundElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: arrow.id,
          type: "arrow",
        }),
      ]),
    );

    Keyboard.undo();

    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect.id, boundElements: [] }),
      expect.objectContaining({ id: arrow.id, isDeleted: true }),
    ]);

    Keyboard.redo();

    expect(h.elements).toEqual([
      expect.objectContaining({
        id: rect.id,
        boundElements: expect.arrayContaining([
          expect.objectContaining({
            id: arrow.id,
            type: "arrow",
          }),
        ]),
      }),
      expect.objectContaining({
        id: arrow.id,
        isDeleted: false,
        endBinding: expect.objectContaining({
          elementId: rect.id,
          focus: expect.any(Number),
          gap: expect.any(Number),
        }),
      }),
    ]);
  });

  it("should preserve arrow bindings after moving rectangle and undo/redo", async () => {
    const rect = UI.createElement("rectangle", {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });

    UI.clickTool("arrow");
    mouse.downAt(50, 150);
    mouse.moveTo(100, 150);
    mouse.up();

    mouse.select(rect);
    mouse.downAt(150, 150);
    mouse.moveTo(250, 150);
    mouse.up();

    const movedArrow = h.elements[1] as ExcalidrawLinearElement;
    const movedRect = h.elements[0] as ExcalidrawRectangleElement;

    expect(movedRect.x).toBe(200);
    expect(movedArrow.endBinding).toEqual(
      expect.objectContaining({
        elementId: rect.id,
        focus: expect.any(Number),
        gap: expect.any(Number),
      }),
    );

    Keyboard.undo();

    const undoRect = h.elements[0] as ExcalidrawRectangleElement;
    const undoArrow = h.elements[1] as ExcalidrawLinearElement;

    expect(undoRect.x).toBe(100);

    expect(undoArrow.endBinding).toEqual(
      expect.objectContaining({
        elementId: rect.id,
        focus: expect.any(Number),
        gap: expect.any(Number),
      }),
    );

    Keyboard.redo();

    const redoRect = h.elements[0] as ExcalidrawRectangleElement;
    const redoArrow = h.elements[1] as ExcalidrawLinearElement;

    expect(redoRect.x).toBe(200);

    expect(redoArrow.endBinding).toEqual(
      expect.objectContaining({
        elementId: rect.id,
        focus: expect.any(Number),
        gap: expect.any(Number),
      }),
    );

    expect(redoRect.x).not.toEqual(undoRect.x);
    expect(redoArrow.endBinding?.elementId).toEqual(rect.id);
  });
});
