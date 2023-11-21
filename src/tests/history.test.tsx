import { assertSelectedElements, render, togglePopover } from "./test-utils";
import { Excalidraw } from "../packages/excalidraw/index";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { API } from "./helpers/api";
import { getDefaultAppState } from "../appState";
import { waitFor } from "@testing-library/react";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";
import { EXPORT_DATA_TYPES, MIME_TYPES } from "../constants";
import { ExcalidrawImperativeAPI } from "../types";
import { resolvablePromise } from "../utils";
import { COLOR_PALETTE } from "../colors";
import { KEYS } from "../keys";
import { newElementWith } from "../element/mutateElement";

const { h } = window;

const mouse = new Pointer("mouse");

describe("history", () => {
  it("initializing scene should end up with no history entry", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "A" })],
          appState: {
            zenModeEnabled: true,
          },
        }}
      />,
    );

    await waitFor(() => {
      expect(h.state.zenModeEnabled).toBe(true);
      expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
      expect(h.history.isUndoStackEmpty).toBeTruthy();
    });

    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);
    // noop
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
    expect(API.getUndoStack().length).toBe(0);

    h.app.actionManager.executeAction(redoAction);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: false }),
      expect.objectContaining({ id: rectangle.id, isDeleted: false }),
    ]);
    expect(API.getUndoStack().length).toBe(1);
  });

  it("scene import via drag&drop should create new history entry", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "A" })],
          appState: {
            viewBackgroundColor: "#FFF",
          },
        }}
      />,
    );

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

    await waitFor(() => expect(API.getUndoStack().length).toBe(1));
    expect(h.state.viewBackgroundColor).toBe("#000");
    expect(h.elements).toEqual([
      expect.objectContaining({ id: "A", isDeleted: true }),
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
      expect.objectContaining({ id: "A", isDeleted: true }),
      expect.objectContaining({ id: "B", isDeleted: false }),
    ]);
  });

  it("undo/redo works properly with groups", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
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

  it("undo/redo should support basic element creation, selection and deletion", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const rect1 = UI.createElement("rectangle", { x: 10 });
    const rect2 = UI.createElement("rectangle", { x: 20, y: 20 });
    const rect3 = UI.createElement("rectangle", { x: 40, y: 40 });

    mouse.select([rect2, rect3]);
    Keyboard.keyDown(KEYS.DELETE);

    expect(API.getUndoStack().length).toBe(6);

    Keyboard.undo();
    assertSelectedElements(rect2, rect3);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id }),
      expect.objectContaining({ id: rect2.id, isDeleted: false }),
      expect.objectContaining({ id: rect3.id, isDeleted: false }),
    ]);

    Keyboard.undo();
    assertSelectedElements(rect2);

    Keyboard.undo();
    assertSelectedElements(rect3);

    Keyboard.undo();
    assertSelectedElements(rect2);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id }),
      expect.objectContaining({ id: rect2.id }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    Keyboard.undo();
    assertSelectedElements(rect1);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id }),
      expect.objectContaining({ id: rect2.id, isDeleted: true }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    Keyboard.undo();
    assertSelectedElements();
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: true }),
      expect.objectContaining({ id: rect2.id, isDeleted: true }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    // no-op
    Keyboard.undo();
    assertSelectedElements();
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: true }),
      expect.objectContaining({ id: rect2.id, isDeleted: true }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    Keyboard.redo();
    assertSelectedElements(rect1);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id }),
      expect.objectContaining({ id: rect2.id, isDeleted: true }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    Keyboard.redo();
    assertSelectedElements(rect2);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id }),
      expect.objectContaining({ id: rect2.id }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    Keyboard.redo();
    assertSelectedElements(rect3);

    Keyboard.redo();
    assertSelectedElements(rect2);

    Keyboard.redo();
    assertSelectedElements(rect2, rect3);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id }),
      expect.objectContaining({ id: rect2.id, isDeleted: false }),
      expect.objectContaining({ id: rect3.id, isDeleted: false }),
    ]);

    Keyboard.redo();
    expect(API.getUndoStack().length).toBe(6);
    expect(API.getRedoStack().length).toBe(0);
    assertSelectedElements();
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: false }),
      expect.objectContaining({ id: rect2.id, isDeleted: true }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);

    // no-op
    Keyboard.redo();
    expect(API.getUndoStack().length).toBe(6);
    expect(API.getRedoStack().length).toBe(0);
    assertSelectedElements();
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: false }),
      expect.objectContaining({ id: rect2.id, isDeleted: true }),
      expect.objectContaining({ id: rect3.id, isDeleted: true }),
    ]);
  });

  describe("multiplayer undo/redo", () => {
    const transparent = COLOR_PALETTE.transparent;
    const red = COLOR_PALETTE.red[1];
    const blue = COLOR_PALETTE.blue[1];
    const yellow = COLOR_PALETTE.yellow[1];
    const violet = COLOR_PALETTE.violet[1];

    let excalidrawAPI: ExcalidrawImperativeAPI;

    beforeEach(async () => {
      const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
      await render(
        <Excalidraw
          excalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
          handleKeyboardGlobally={true}
        />,
      );
      excalidrawAPI = await excalidrawAPIPromise;
    });

    it("applying history entries should not override remote changes on different elements", () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      expect(API.getUndoStack().length).toBe(2);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          ...h.elements,
          API.createElement({
            type: "rectangle",
            strokeColor: blue,
          }),
        ],
      });

      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: transparent }),
        expect.objectContaining({ strokeColor: blue }),
      ]);

      Keyboard.redo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
        expect.objectContaining({ strokeColor: blue }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getUndoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: transparent }),
        expect.objectContaining({ strokeColor: blue }),
      ]);
    });

    it("applying history entries should not override remote changes on different props", () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      expect(API.getUndoStack().length).toBe(2);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            strokeColor: yellow,
          }),
        ],
      });

      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: transparent,
          strokeColor: yellow,
        }),
      ]);

      Keyboard.redo();
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: red,
          strokeColor: yellow,
        }),
      ]);
    });

    // https://www.figma.com/blog/how-figmas-multiplayer-technology-works/#implementing-undo
    it("history entries should get updated after remote changes on same props", async () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");
      UI.clickOnTestId("color-blue");

      // At this point we have all the history entries created, no new entries will be created, only existing entries will get inversed and updated
      expect(API.getUndoStack().length).toBe(3);

      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
      ]);

      Keyboard.redo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: blue }),
      ]);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: yellow,
          }),
        ],
      });

      // At this point our entry gets updated from `red` -> `blue` into `red` -> `yellow`
      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
      ]);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: violet,
          }),
        ],
      });

      // At this point our (inversed) entry gets updated from `red` -> `yellow` into `violet` -> `yellow`
      Keyboard.redo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: yellow }),
      ]);

      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: violet }),
      ]);

      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: transparent }),
      ]);
    });

    it("")

    it("should iterate through the history when element changes relate only to remotely deleted elements", async () => {
      const rect1 = UI.createElement("rectangle", { x: 10 });

      const rect2 = UI.createElement("rectangle", { x: 20 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      const rect3 = UI.createElement("rectangle", { x: 30, y: 30 });

      mouse.downAt(35, 35);
      mouse.moveTo(55, 55);
      mouse.upAt(55, 55);

      expect(API.getUndoStack().length).toBe(5);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
          newElementWith(h.elements[2], {
            isDeleted: true,
          }),
        ],
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(4);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect1.id }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
        }),
        expect.objectContaining({
          id: rect2.id,
          isDeleted: true,
          backgroundColor: transparent,
        }),
        expect.objectContaining({
          id: rect3.id,
          isDeleted: true,
          x: 30,
          y: 30,
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(5);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect3.id }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
        }),
        expect.objectContaining({
          id: rect2.id,
          isDeleted: true,
          backgroundColor: red,
        }),
        expect.objectContaining({
          id: rect3.id,
          isDeleted: true,
          x: 50,
          y: 50,
        }),
      ]);
    });

    it("should iterate through the history when selection changes relate only to remotely deleted elements", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 });
      const rect2 = API.createElement({ type: "rectangle", x: 20, y: 20 });
      const rect3 = API.createElement({ type: "rectangle", x: 30, y: 30 });

      h.elements = [rect1, rect2, rect3];
      mouse.select(rect1);
      mouse.select([rect2, rect3]);

      expect(API.getUndoStack().length).toBe(3);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
          newElementWith(h.elements[2], {
            isDeleted: true,
          }),
        ],
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect1.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);
    });

    it("should iterate through the history when selection changes relate only to remotely deleted elements", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 });
      const rect2 = API.createElement({ type: "rectangle", x: 20, y: 20 });
      const rect3 = API.createElement({ type: "rectangle", x: 30, y: 30 });

      h.elements = [rect1, rect2, rect3];
      mouse.select(rect1);
      mouse.select([rect2, rect3]);

      expect(API.getUndoStack().length).toBe(3);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
          newElementWith(h.elements[2], {
            isDeleted: true,
          }),
        ],
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect1.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);
    });

    it("remote update should not interfere with in progress freedraw", async () => {
      UI.clickTool("freedraw");
      mouse.down(10, 10);
      mouse.moveTo(30, 30);

      // Simulate remote update
      const rect = API.createElement({
        type: "rectangle",
        strokeColor: blue,
      });

      excalidrawAPI.updateScene({
        elements: [...h.elements, rect],
      });

      mouse.moveTo(60, 60);
      mouse.up();

      Keyboard.undo();

      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: h.elements[0].id,
          type: "freedraw",
          isDeleted: true,
        }),
        expect.objectContaining({ ...rect }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: h.elements[0].id,
          type: "freedraw",
          isDeleted: false,
        }),
        expect.objectContaining({ ...rect }),
      ]);
    });

    // TODO_UNDO: tests like this might need to go through some util, as expectations in redo / undo are duplicated
    it("remote update should not interfere with in progress dragging", async () => {
      const rect1 = UI.createElement("rectangle", { x: 10, y: 10 });
      const rect2 = UI.createElement("rectangle", { x: 30, y: 30 });

      mouse.select([rect1, rect2]);
      mouse.downAt(20, 20);
      mouse.moveTo(50, 50);

      assertSelectedElements(rect1, rect2);
      expect(API.getUndoStack().length).toBe(4);

      const rect3 = API.createElement({
        type: "rectangle",
        strokeColor: blue,
      });

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [...h.elements, rect3],
      });

      mouse.moveTo(100, 100);
      mouse.up();

      expect(API.getUndoStack().length).toBe(5);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect1, rect2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 90,
          y: 90,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 110,
          y: 110,
          isDeleted: false,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);

      Keyboard.undo();
      assertSelectedElements(rect1, rect2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 10,
          y: 10,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 30,
          y: 30,
          isDeleted: false,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);

      Keyboard.undo();
      assertSelectedElements(rect1);

      Keyboard.undo();
      assertSelectedElements(rect2);

      Keyboard.undo();
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 10,
          y: 10,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 30,
          y: 30,
          isDeleted: true,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);

      Keyboard.undo();
      assertSelectedElements();
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 10,
          y: 10,
          isDeleted: true,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 30,
          y: 30,
          isDeleted: true,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);

      Keyboard.redo();
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 10,
          y: 10,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 30,
          y: 30,
          isDeleted: true,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);

      Keyboard.redo();
      assertSelectedElements(rect2);

      Keyboard.redo();
      assertSelectedElements(rect1);

      Keyboard.redo();
      assertSelectedElements(rect1, rect2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 10,
          y: 10,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 30,
          y: 30,
          isDeleted: false,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(5);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect1, rect2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          x: 90,
          y: 90,
          isDeleted: false,
        }),
        expect.objectContaining({
          id: rect2.id,
          x: 110,
          y: 110,
          isDeleted: false,
        }),
        expect.objectContaining({ ...rect3 }),
      ]);
    });

    // TODO_UNDO: testing testing David' concurrency issues (dragging, image, etc.)
    // TODO_UNDO: test "UPDATE" actions as they become undoable (), but are necessary for the diff calculation and unexpect during undo / redo (also test change CAPTURE)
    // TODO_UNDO: testing edge cases - bound elements get often messed up (i.e.  when client 1 adds it to client2 element and client 2 undos)
    // TODO_UNDO: testing edge cases - empty undos - when item are already selected
    // TODO_UNDO: testing z-index actions (after Ryans PR)
    // TODO_UNDO: testing linear element + editor (multiple, single clients / empty undo / redos / selection)
    // TODO_UNDO: testing edge cases - align actions bugs
    // TODO_UNDO: testing edge cases - unit testing quick quick reference checks and exits
    // TODO_UNDO: testing edge cases - add what elements should not contain (notEqual)
    // TODO_UNDO: testing edge cases - clearing of redo stack
    // TODO_UNDO: testing edge cases - expected reference values in deltas
    // TODO_UNDO: testing edge cases - caching / cloning of snapshot and its disposal
    // TODO_UNDO: testing edge cases - state of the stored increments / changes and their deltas
    // TODO_UNDO: test out number of store calls in collab
  });
});
