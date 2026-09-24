import React from "react";

import { DEFAULT_DIMENSION, isArrowElement } from "@excalidraw/element";
import {
  COLOR_PALETTE,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  KEYS,
  MIN_WIDTH_OR_HEIGHT,
  reseed,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  KEYBOARD_PLACEMENT_MOVE_STEP,
  KEYBOARD_PLACEMENT_RESIZE_STEP,
} from "../components/App.keyboardPlacement";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { act, fireEvent, render, screen, unmountComponent } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

const startPlacement = (key: string) => {
  Keyboard.keyPress(key);
  const preview = h.app.keyboardPlacement.preview;
  expect(preview).not.toBeNull();
  return preview!;
};

const commitPlacement = () => Keyboard.keyPress(KEYS.ENTER);

beforeEach(() => {
  unmountComponent();
  localStorage.clear();
  reseed(7);
});

describe("keyboard shape placement", () => {
  it.each([
    ["r", "rectangle"],
    ["2", "rectangle"],
    ["d", "diamond"],
    ["3", "diamond"],
    ["o", "ellipse"],
    ["4", "ellipse"],
  ] as const)(
    "creates a %s shortcut shape without pointer input",
    async (key, type) => {
      await render(<Excalidraw handleKeyboardGlobally />);

      startPlacement(key);
      expect(h.elements).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent(
        `${type[0].toUpperCase()}${type.slice(1)} placement`,
      );

      commitPlacement();

      expect(h.app.keyboardPlacement.preview).toBeNull();
      expect(h.elements).toHaveLength(1);
      expect(h.elements[0]).toMatchObject({
        type,
        width: DEFAULT_DIMENSION,
        height: DEFAULT_DIMENSION,
      });
      expect(h.state.selectedElementIds).toEqual({ [h.elements[0].id]: true });
      expect(h.state.activeTool.type).toBe("selection");
    },
  );

  it("shows a gray preview and restores the selected colors on commit", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({
      currentItemStrokeColor: COLOR_PALETTE.red[4],
      currentItemBackgroundColor: COLOR_PALETTE.blue[1],
      currentItemOpacity: 20,
    });

    const preview = startPlacement("r");
    expect(preview).toMatchObject({
      strokeColor: COLOR_PALETTE.gray[3],
      backgroundColor: COLOR_PALETTE.gray[1],
      opacity: 100,
    });

    commitPlacement();
    expect(h.elements[0]).toMatchObject({
      strokeColor: COLOR_PALETTE.red[4],
      backgroundColor: COLOR_PALETTE.blue[1],
      opacity: 20,
    });
  });

  it("starts centered in visible canvas coordinates", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const center = viewportCoordsToSceneCoords(
      {
        clientX: h.state.offsetLeft + h.state.width / 2,
        clientY: h.state.offsetTop + h.state.height / 2,
      },
      h.state,
    );

    const preview = startPlacement("r");

    expect(preview.x + preview.width / 2).toBe(center.x);
    expect(preview.y + preview.height / 2).toBe(center.y);
  });

  it("moves with Arrow keys and resizes from its center with Shift+Arrow", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const initial = startPlacement("r");
    expect(KEYBOARD_PLACEMENT_MOVE_STEP).toBeGreaterThan(
      ELEMENT_TRANSLATE_AMOUNT,
    );
    expect(KEYBOARD_PLACEMENT_RESIZE_STEP).toBeGreaterThan(
      ELEMENT_SHIFT_TRANSLATE_AMOUNT,
    );

    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    Keyboard.keyPress(KEYS.ARROW_DOWN);

    const moved = h.app.keyboardPlacement.preview!;
    expect(moved).toMatchObject({
      x: initial.x + KEYBOARD_PLACEMENT_MOVE_STEP,
      y: initial.y + KEYBOARD_PLACEMENT_MOVE_STEP,
      width: initial.width,
      height: initial.height,
    });

    const centerBeforeResize = {
      x: moved.x + moved.width / 2,
      y: moved.y + moved.height / 2,
    };
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    const resized = h.app.keyboardPlacement.preview!;
    expect(resized.width).toBe(initial.width + KEYBOARD_PLACEMENT_RESIZE_STEP);
    expect(resized.height).toBe(
      initial.height + KEYBOARD_PLACEMENT_RESIZE_STEP,
    );
    expect(resized.x + resized.width / 2).toBe(centerBeforeResize.x);
    expect(resized.y + resized.height / 2).toBe(centerBeforeResize.y);
    expect(h.elements).toHaveLength(0);
  });

  it.each([
    ["r", "rectangle"],
    ["d", "diamond"],
    ["o", "ellipse"],
  ] as const)(
    "keeps a repeatedly shrunk %s shape finite and positive",
    async (key, type) => {
      await render(<Excalidraw handleKeyboardGlobally />);
      const initial = startPlacement(key);
      const center = {
        x: initial.x + initial.width / 2,
        y: initial.y + initial.height / 2,
      };

      Keyboard.withModifierKeys({ shift: true }, () => {
        for (let index = 0; index < 25; index++) {
          Keyboard.keyPress(KEYS.ARROW_LEFT);
          Keyboard.keyPress(KEYS.ARROW_UP);
        }
      });

      const preview = h.app.keyboardPlacement.preview!;
      expect(preview).toMatchObject({
        type,
        width: MIN_WIDTH_OR_HEIGHT,
        height: MIN_WIDTH_OR_HEIGHT,
      });
      expect(Number.isFinite(preview.x)).toBe(true);
      expect(Number.isFinite(preview.y)).toBe(true);
      expect(preview.x + preview.width / 2).toBe(center.x);
      expect(preview.y + preview.height / 2).toBe(center.y);

      commitPlacement();
      expect(h.elements[0]).toMatchObject({
        type,
        width: MIN_WIDTH_OR_HEIGHT,
        height: MIN_WIDTH_OR_HEIGHT,
      });
    },
  );

  it("uses a larger grid size for movement and resizing", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const gridSize = 25;
    API.setAppState({ gridModeEnabled: true, gridSize });
    const initial = startPlacement("r");

    expect(Math.abs(initial.x % gridSize)).toBe(0);
    expect(Math.abs(initial.y % gridSize)).toBe(0);

    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    const preview = h.app.keyboardPlacement.preview!;
    expect(preview.x).toBe(initial.x + gridSize);
    expect(preview.height).toBe(initial.height + gridSize);
    expect(preview.y).toBe(initial.y - gridSize / 2);

    Keyboard.keyPress(KEYS.ESCAPE);
    API.setAppState({ gridSize: DEFAULT_DIMENSION * 2 });
    const oversizedGridPreview = startPlacement("r");
    const centerBeforeShrink =
      oversizedGridPreview.x + oversizedGridPreview.width / 2;
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });

    const safelyShrunk = h.app.keyboardPlacement.preview!;
    expect(safelyShrunk.width).toBe(MIN_WIDTH_OR_HEIGHT);
    expect(safelyShrunk.width).toBeLessThan(oversizedGridPreview.width);
    expect(safelyShrunk.x + safelyShrunk.width / 2).toBe(centerBeforeShrink);
  });

  it("cancels with Escape without creating or capturing an element", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("d");

    Keyboard.keyPress(KEYS.ESCAPE);

    expect(h.app.keyboardPlacement.preview).toBeNull();
    expect(h.elements).toHaveLength(0);
    expect(API.getUndoStack()).toHaveLength(0);
    expect(h.state.activeTool.type).toBe("selection");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Keyboard placement cancelled",
    );
  });

  it("undoes and redoes a committed keyboard-created element", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("o");
    commitPlacement();

    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);

    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);

    Keyboard.redo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
  });

  it("cancels a pending placement before keyboard undo and redo", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");
    commitPlacement();
    startPlacement("d");

    Keyboard.undo();

    expect(h.app.keyboardPlacement.preview).toBeNull();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);

    Keyboard.redo();
    expect(h.app.keyboardPlacement.preview).toBeNull();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
  });

  it("cancels a pending placement before pointer-driven undo", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");
    commitPlacement();
    startPlacement("d");
    const undoButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="button-undo"]',
    )!;

    fireEvent.pointerDown(undoButton, { button: 0 });
    fireEvent.click(undoButton);

    expect(h.app.keyboardPlacement.preview).toBeNull();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);
  });

  it("preserves Arrow-key movement after the element is committed", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");
    commitPlacement();
    const initialX = h.elements[0].x;

    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    expect(h.elements[0].x).toBe(initialX + ELEMENT_TRANSLATE_AMOUNT);
  });

  it("keeps pointer-based shape creation unchanged", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally />,
    );
    fireEvent.click(getByToolName("rectangle"));
    expect(h.app.keyboardPlacement.preview).toBeNull();

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(canvas, { clientX: 60, clientY: 70 });

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0]).toMatchObject({
      type: "rectangle",
      x: 30,
      y: 20,
      width: 30,
      height: 50,
    });
  });

  it("hands a keyboard-created shape to existing Enter label editing", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");
    commitPlacement();
    const rectangle = h.elements[0];

    Keyboard.keyDown(KEYS.ENTER);

    expect(h.state.editingTextElement).toMatchObject({
      type: "text",
      containerId: rectangle.id,
    });
  });

  it("uses existing Ctrl/Cmd+Arrow flowchart creation and bindings", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");
    commitPlacement();
    const source = h.elements[0];

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    // Flowchart creation commits when its driving modifier is released.
    Keyboard.keyUp("Control");

    const visibleElements = h.elements.filter((element) => !element.isDeleted);
    expect(visibleElements).toHaveLength(3);
    const target = visibleElements.find(
      (element) => element.type === "rectangle" && element.id !== source.id,
    );
    const arrow = visibleElements.find(isArrowElement);
    expect(target).toBeDefined();
    expect(arrow).toMatchObject({
      startBinding: { elementId: source.id },
      endBinding: { elementId: target!.id },
    });
    expect(h.state.selectedElementIds).toEqual({ [target!.id]: true });
  });

  it("continues from placement through labeling, flowchart creation, undo, and redo", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    commitPlacement();
    const source = h.elements[0];

    Keyboard.keyDown(KEYS.ENTER);
    const editor = await getTextEditor();
    fireEvent.input(editor, { target: { value: "Start" } });
    Keyboard.exitTextEditor(editor);

    const label = h.elements.find((element) => element.type === "text");
    expect(label).toMatchObject({ text: "Start", containerId: source.id });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp("Control");

    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(4);

    Keyboard.undo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(2);

    Keyboard.redo();
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(4);
  });

  it("centers correctly when the canvas is zoomed and scrolled", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({
      width: 800,
      height: 600,
      offsetLeft: 120,
      offsetTop: 80,
      scrollX: -45,
      scrollY: 30,
      zoom: { value: 2 as NormalizedZoomValue },
    });
    const expectedCenter = viewportCoordsToSceneCoords(
      {
        clientX: h.state.offsetLeft + h.state.width / 2,
        clientY: h.state.offsetTop + h.state.height / 2,
      },
      h.state,
    );

    const preview = startPlacement("o");

    expect(preview.x + preview.width / 2).toBe(expectedCenter.x);
    expect(preview.y + preview.height / 2).toBe(expectedCenter.y);
  });

  it("does not start placement from interactive or editable controls", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");
    const controls = [
      document.createElement("input"),
      document.createElement("textarea"),
      document.createElement("select"),
      document.createElement("button"),
      contentEditable,
    ];

    for (const control of controls) {
      container.appendChild(control);
      control.focus();
      Keyboard.keyPress("r", control);
      expect(h.app.keyboardPlacement.preview).toBeNull();
      expect(h.state.activeTool.type).toBe("selection");
    }
  });

  it("does not handle placement keys from editable controls", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const initial = startPlacement("r");
    const input = document.createElement("input");
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");
    container.append(input, contentEditable);

    for (const control of [input, contentEditable]) {
      control.focus();
      fireEvent.keyDown(control, { key: KEYS.ARROW_RIGHT });
      fireEvent.keyDown(control, { key: KEYS.ENTER });
    }

    expect(h.app.keyboardPlacement.preview).toMatchObject({
      id: initial.id,
      x: initial.x,
      y: initial.y,
    });
    expect(h.elements).toHaveLength(0);
  });

  it("replaces the pending shape cleanly when another shortcut is used", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    const rectangle = startPlacement("r");
    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    Keyboard.keyPress("d");

    const diamond = h.app.keyboardPlacement.preview!;
    expect(diamond.type).toBe("diamond");
    expect(diamond.id).not.toBe(rectangle.id);
    expect(diamond.x).toBe(rectangle.x);
    expect(h.elements).toHaveLength(0);
    expect(API.getUndoStack()).toHaveLength(0);

    Keyboard.keyPress(KEYS.ESCAPE);
    expect(h.app.keyboardPlacement.preview).toBeNull();
  });

  it("cleans up on tool changes and overlays", async () => {
    const { getByToolName } = await render(
      <Excalidraw handleKeyboardGlobally />,
    );
    startPlacement("r");

    fireEvent.click(getByToolName("diamond"));
    expect(h.app.keyboardPlacement.preview).toBeNull();
    expect(h.elements).toHaveLength(0);

    startPlacement("o");
    API.setAppState({ openDialog: { name: "help" } });
    expect(h.app.keyboardPlacement.preview).toBeNull();

    API.setAppState({ openDialog: null });
    act(() => h.app.setActiveTool({ type: "selection" }));
    API.setAppState({ openDialog: { name: "help" } });
    Keyboard.keyPress("r");
    expect(h.app.keyboardPlacement.preview).toBeNull();
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("cancels when focus leaves the editor", async () => {
    const { container } = await render(<Excalidraw handleKeyboardGlobally />);
    const editor = container.querySelector<HTMLElement>(".excalidraw")!;
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    act(() => editor.focus());
    startPlacement("r");

    act(() => outsideButton.focus());

    expect(h.app.keyboardPlacement.preview).toBeNull();
    outsideButton.remove();
  });

  it("cancels when the owner window loses focus", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    startPlacement("r");

    fireEvent.blur(h.app.ownerWindow);

    expect(h.app.keyboardPlacement.preview).toBeNull();
  });

  it.each([
    ["r", "rectangle"],
    ["d", "diamond"],
    ["o", "ellipse"],
  ] as const)(
    "cancels the %s preview before the normal pointer workflow starts",
    async (key, type) => {
      const { container } = await render(<Excalidraw handleKeyboardGlobally />);
      const preview = startPlacement(key);
      const canvas = container.querySelector("canvas.interactive")!;

      fireEvent.pointerMove(canvas, { clientX: 5, clientY: 5 });
      expect(h.app.keyboardPlacement.preview?.id).toBe(preview.id);
      expect(h.elements).toHaveLength(0);

      fireEvent.pointerDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 50, clientY: 80 });
      fireEvent.pointerUp(canvas, { clientX: 50, clientY: 80 });

      expect(h.app.keyboardPlacement.preview).toBeNull();
      expect(h.elements).toHaveLength(1);
      expect(h.elements[0]).toMatchObject({
        type,
        x: 10,
        y: 20,
        width: 40,
        height: 60,
      });
      expect(API.getUndoStack()).toHaveLength(1);
    },
  );
});
