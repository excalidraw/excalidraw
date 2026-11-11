import React from "react";

import {
  DEFAULT_STICKY_NOTE_SIZE,
  KEYS,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import type { ExcalidrawStickyNoteElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import { fireEvent, GlobalTestState, render } from "./test-utils";

const { h } = window;

const POINTER = { pointerId: 1, pointerType: "mouse", isPrimary: true };

const stickyButton = () =>
  GlobalTestState.renderResult.getByToolName("stickynote");

/** press the tool button and move the pointer to (x, y) on the canvas */
const dragOut = (x: number, y: number) => {
  fireEvent.pointerDown(stickyButton(), {
    ...POINTER,
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(window, { ...POINTER, clientX: x, clientY: y });
};

const liveNotes = () =>
  h.elements.filter(
    (element) => element.type === "stickynote" && !element.isDeleted,
  ) as ExcalidrawStickyNoteElement[];

describe("dragging a tool out of the toolbar", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ width: 1000, height: 800 });
  });

  it("previews while dragging without touching the scene, and drops one note", async () => {
    // whatever tool is active must not stay armed under the dropped note
    UI.clickTool("arrow");
    expect(h.state.activeTool.type).toBe("arrow");

    // under the drag threshold nothing happens — a press is still a click
    fireEvent.pointerDown(stickyButton(), {
      ...POINTER,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, { ...POINTER, clientX: 3, clientY: 3 });
    expect(h.app.toolDrag.preview).toBeNull();

    fireEvent.pointerMove(window, { ...POINTER, clientX: 300, clientY: 260 });
    const preview = h.app.toolDrag.preview!;
    expect(preview).not.toBeNull();
    expect(preview.type).toBe("stickynote");
    expect([preview.width, preview.height]).toEqual([
      DEFAULT_STICKY_NOTE_SIZE,
      DEFAULT_STICKY_NOTE_SIZE,
    ]);
    // the preview is not an element yet: nothing for collaborators or history
    expect(h.elements).toHaveLength(0);
    expect(API.getUndoStack()).toHaveLength(0);

    fireEvent.pointerMove(window, { ...POINTER, clientX: 400, clientY: 350 });
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      ...POINTER,
      button: 0,
      clientX: 400,
      clientY: 350,
    });

    expect(h.app.toolDrag.preview).toBeNull();
    const [note] = liveNotes();
    expect(liveNotes()).toHaveLength(1);
    // centered on the pointer, at the default size
    const center = viewportCoordsToSceneCoords(
      { clientX: 400, clientY: 350 },
      h.state,
    );
    expect(note.x + note.width / 2).toBeCloseTo(center.x);
    expect(note.y + note.height / 2).toBeCloseTo(center.y);
    expect(note.width).toBe(DEFAULT_STICKY_NOTE_SIZE);
    expect(note.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
    // The drop is recorded while its label is being edited.
    expect(h.state.editingTextElement).not.toBeNull();
    expect(API.getUndoStack()).toHaveLength(1);
    // back on the selection tool (the editor owns the selection meanwhile,
    // as on the click path)
    expect(h.state.activeTool.type).toBe("selection");

    // Abandoning the editor leaves one visible action; undo removes the note.
    Keyboard.keyPress(KEYS.ESCAPE, await getTextEditor());
    expect(API.getUndoStack()).toHaveLength(1);
    Keyboard.undo();
    expect(liveNotes()).toHaveLength(0);
  });

  it("places the preview and dropped note on the grid", () => {
    API.setAppState({ gridModeEnabled: true, gridSize: 20 });
    dragOut(300, 300);
    expect(h.app.toolDrag.preview).toMatchObject({ x: 180, y: 180 });

    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      ...POINTER,
      button: 0,
      clientX: 300,
      clientY: 300,
    });
    expect(liveNotes()[0]).toMatchObject({ x: 180, y: 180 });
  });

  it("leaves nothing behind when Escape cancels the drag", () => {
    dragOut(300, 260);
    expect(h.app.toolDrag.preview).not.toBeNull();

    fireEvent.keyDown(window, { key: KEYS.ESCAPE });
    expect(h.app.toolDrag.preview).toBeNull();

    // a pointer-up arriving after the cancel is inert
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      ...POINTER,
      button: 0,
      clientX: 300,
      clientY: 260,
    });
    expect(h.elements).toHaveLength(0);
    expect(API.getUndoStack()).toHaveLength(0);
    expect(h.state.editingTextElement).toBeNull();
  });

  it("drops nothing when released outside the canvas", () => {
    dragOut(300, 260);
    fireEvent.pointerUp(document.body, {
      ...POINTER,
      button: 0,
      clientX: 300,
      clientY: 260,
    });
    expect(h.app.toolDrag.preview).toBeNull();
    expect(h.elements).toHaveLength(0);
    expect(API.getUndoStack()).toHaveLength(0);
  });

  it("keeps a plain click selecting the tool", () => {
    const button = stickyButton();
    fireEvent.pointerDown(button, { ...POINTER, button: 0 });
    fireEvent.pointerUp(button, { ...POINTER, button: 0 });
    fireEvent.click(button);
    expect(h.state.activeTool.type).toBe("stickynote");
    expect(h.app.toolDrag.preview).toBeNull();
    expect(h.elements).toHaveLength(0);
  });
});
