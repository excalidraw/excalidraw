import { assertSelectedElements, render } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { API } from "./helpers/api";
import { getDefaultAppState } from "../appState";
import { waitFor } from "@testing-library/react";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";
import { EXPORT_DATA_TYPES, MIME_TYPES } from "../constants";

const { h } = window;

const mouse = new Pointer("mouse");

describe("history", () => {
  it("initializing scene should end up with single history entry", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [API.createElement({ type: "rectangle", id: "A" })],
        appState: {
          zenModeEnabled: true,
        },
      },
    });

    await waitFor(() => expect(h.state.zenModeEnabled).toBe(true));
    await waitFor(() =>
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]),
    );
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
    ]);
    const rectangle = UI.createElement("rectangle");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A" }),
      expect.objectContaining({ id: rectangle.id }),
    ]);
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: true }),
    ]);

    // noop
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: true }),
    ]);
    expect(API.getStateHistory().length).toBe(1);

    h.app.actionManager.executeAction(redoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: false }),
    ]);
    expect(API.getStateHistory().length).toBe(2);
  });

  it("scene import via drag&drop should create new history entry", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [API.createElement({ type: "rectangle", id: "A" })],
        appState: {
          viewBackgroundColor: "#FFF",
        },
      },
    });

    await waitFor(() => expect(h.state.viewBackgroundColor).toBe("#FFF"));
    await waitFor(() =>
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]),
    );

    API.drop(
      new Blob(
        [
          JSON.stringify({
            type: EXPORT_DATA_TYPES.excalidraw,
            appState: {
              ...getDefaultAppState(),
              viewBackgroundColor: "#000",
            },
            elements: [API.createElement({ type: "rectangle", id: "B" })],
          }),
        ],
        { type: MIME_TYPES.json },
      ),
    );

    await waitFor(() => expect(API.getStateHistory().length).toBe(2));
    expect(h.state.viewBackgroundColor).toBe("#000");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "B", isDeleted: false }),
    ]);

    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);
    h.app.actionManager.executeAction(undoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: "B", isDeleted: true }),
    ]);
    expect(h.state.viewBackgroundColor).toBe("#FFF");
    h.app.actionManager.executeAction(redoAction);
    expect(h.state.viewBackgroundColor).toBe("#000");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "B", isDeleted: false }),
      expect.objectContaining({ id: "A", isDeleted: true }),
    ]);
  });

  it("undo/redo works properly with groups", async () => {
    await render(<ExcalidrawApp />);
    const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
    const rect2 = API.createElement({ type: "rectangle", groupIds: ["A"] });

    h.elements = [rect1, rect2];
    mouse.select(rect1);
    assertSelectedElements([rect1, rect2]);
    expect(h.state.selectedGroupIds).toEqual({ A: true });

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress("d");
    });
    expect(h.elements.length).toBe(4);
    assertSelectedElements([h.elements[2], h.elements[3]]);
    expect(h.state.selectedGroupIds).not.toEqual(
      expect.objectContaining({ A: true }),
    );

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress("z");
    });
    expect(h.elements.length).toBe(4);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: false }),
      expect.objectContaining({ id: rect2.id, isDeleted: false }),
      expect.objectContaining({ id: `${rect1.id}_copy`, isDeleted: true }),
      expect.objectContaining({ id: `${rect2.id}_copy`, isDeleted: true }),
    ]);
    expect(h.state.selectedGroupIds).toEqual({ A: true });

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress("z");
    });
    expect(h.elements.length).toBe(4);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: false }),
      expect.objectContaining({ id: rect2.id, isDeleted: false }),
      expect.objectContaining({ id: `${rect1.id}_copy`, isDeleted: false }),
      expect.objectContaining({ id: `${rect2.id}_copy`, isDeleted: false }),
    ]);
    expect(h.state.selectedGroupIds).not.toEqual(
      expect.objectContaining({ A: true }),
    );

    // undo again, and duplicate once more
    // -------------------------------------------------------------------------

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress("z");
      Keyboard.keyPress("d");
    });
    expect(h.elements.length).toBe(6);
    expect(h.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
        expect.objectContaining({ id: `${rect1.id}_copy`, isDeleted: true }),
        expect.objectContaining({ id: `${rect2.id}_copy`, isDeleted: true }),
        expect.objectContaining({
          id: `${rect1.id}_copy_copy`,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: `${rect2.id}_copy_copy`,
          isDeleted: false,
        }),
      ]),
    );
    expect(h.state.selectedGroupIds).not.toEqual(
      expect.objectContaining({ A: true }),
    );
  });
});
