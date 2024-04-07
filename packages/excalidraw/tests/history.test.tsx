import * as StaticScene from "../renderer/staticScene";
import {
  act,
  assertSelectedElements,
  render,
  togglePopover,
} from "./test-utils";
import { Excalidraw } from "../index";
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
import {
  ExcalidrawGenericElement,
  ExcalidrawTextElement,
} from "../element/types";
import {
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
} from "../actions";
import { vi } from "vitest";

const { h } = window;

const mouse = new Pointer("mouse");

const checkpoint = (name: string) => {
  expect(renderStaticScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );

  const { name: _, ...strippedAppState } = h.state;
  expect(strippedAppState).toMatchSnapshot(`[${name}] appState`);
  expect(h.history).toMatchSnapshot(`[${name}] history`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);
  h.elements
    .map(({ seed, versionNonce, ...strippedElement }) => strippedElement)
    .forEach((element, i) =>
      expect(element).toMatchSnapshot(`[${name}] element ${i}`),
    );
};

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

const transparent = COLOR_PALETTE.transparent;
const red = COLOR_PALETTE.red[1];
const blue = COLOR_PALETTE.blue[1];
const yellow = COLOR_PALETTE.yellow[1];
const violet = COLOR_PALETTE.violet[1];

describe("history", () => {
  beforeEach(() => {
    renderStaticScene.mockClear();
  });

  afterEach(() => {
    checkpoint("end of test");
  });

  describe("singleplayer undo/redo", () => {
    it("should not end up with history entry when there are no appstate changes", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({ type: "rectangle", groupIds: ["A"] });

      h.elements = [rect1, rect2];
      mouse.select(rect1);
      assertSelectedElements([rect1, rect2]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);

      mouse.select(rect2);
      assertSelectedElements([rect1, rect2]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
      expect(API.getUndoStack().length).toBe(1); // no new entry was created
      expect(API.getRedoStack().length).toBe(0);
    });

    it("should not end up with history entry when there are no elements changes", async () => {
      const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
      await render(
        <Excalidraw
          excalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
          handleKeyboardGlobally={true}
        />,
      );
      const excalidrawAPI = await excalidrawAPIPromise;

      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle" });

      excalidrawAPI.updateScene({
        elements: [rect1, rect2],
        commitToStore: true,
      });

      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);

      excalidrawAPI.updateScene({
        elements: [rect1, rect2],
        commitToStore: true, // even though the flag is on, same elements are passed, nothing to commit
      });
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);
    });

    it("should clear the redo stack on elements change", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const rect1 = UI.createElement("rectangle", { x: 10 });

      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements()).toEqual([]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: true }),
      ]);

      const rect2 = UI.createElement("rectangle", { x: 20 });

      assertSelectedElements(rect2);
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0); // redo stack got cleared
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: true }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: true }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);
    });

    it("should not clear the redo stack on standalone appstate change", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const rect1 = UI.createElement("rectangle", { x: 10 });
      const rect2 = UI.createElement("rectangle", { x: 20 });

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect2);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: true }),
      ]);

      mouse.clickAt(-10, -10);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1); // we still have a possibility to redo!
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: true }),
      ]);

      mouse.downAt(0, 0);
      mouse.moveTo(50, 50);
      mouse.upAt(50, 50);
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(1); // even after re-select!
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: true }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect2);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);
    });

    it("should not override appstate changes when redo stack is not cleared", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const rect = UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");
      UI.clickOnTestId("color-blue");

      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: blue }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements(rect);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: red }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      assertSelectedElements(rect);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: transparent }),
      ]);

      mouse.clickAt(-10, -10);
      expect(API.getUndoStack().length).toBe(2); // pushed appstate change,
      expect(API.getRedoStack().length).toBe(2); // redo stack is not cleared
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: transparent }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements().length).toBe(0); // previously the item was selected, not it is not
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: red }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements().length).toBe(0); // previously the item was selected, not it is not
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: blue }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements().length).toBe(0); // previously the item was selected, not it is not
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: red }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(2);
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: transparent }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(3);
      assertSelectedElements(rect); // get's reselected with out pushed entry!
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, backgroundColor: transparent }),
      ]);
    });

    it("should iterate through the history when selection changes do not produce visible change", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const rect = UI.createElement("rectangle", { x: 10 });

      mouse.clickAt(-10, -10);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements().length).toBe(0);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements(rect);

      mouse.clickAt(-10, -10);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements().length).toBe(0);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2); // now we have two same redos
      assertSelectedElements(rect);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1); // didn't iterate through completely, as first redo already results in a visible change
      expect(API.getSelectedElements().length).toBe(0);

      Keyboard.redo(); // acceptable empty redo
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements().length).toBe(0);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements(rect);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0); // now we iterated through the same undos!
      expect(API.getRedoStack().length).toBe(3);
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, isDeleted: true }),
      ]);
    });

    it("should end up with no history entry after initializing scene", async () => {
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

      const undoAction = createUndoAction(h.history, h.store);
      const redoAction = createRedoAction(h.history, h.store);
      // noop
      act(() => h.app.actionManager.executeAction(undoAction));
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
      ]);
      const rectangle = UI.createElement("rectangle");
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: rectangle.id }),
      ]);
      act(() => h.app.actionManager.executeAction(undoAction));
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: rectangle.id, isDeleted: true }),
      ]);

      // noop
      act(() => h.app.actionManager.executeAction(undoAction));
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: rectangle.id, isDeleted: true }),
      ]);
      expect(API.getUndoStack().length).toBe(0);

      act(() => h.app.actionManager.executeAction(redoAction));
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: rectangle.id, isDeleted: false }),
      ]);
      expect(API.getUndoStack().length).toBe(1);
    });

    it("should create new history entry on scene import via drag&drop", async () => {
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
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining({ id: "A", isDeleted: true }),
        expect.objectContaining({ id: "B", isDeleted: false }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "B", isDeleted: false }),
      ]);

      const undoAction = createUndoAction(h.history, h.store);
      const redoAction = createRedoAction(h.history, h.store);
      act(() => h.app.actionManager.executeAction(undoAction));

      expect(API.getSnapshot()).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(h.state.viewBackgroundColor).toBe("#FFF");

      act(() => h.app.actionManager.executeAction(redoAction));
      expect(h.state.viewBackgroundColor).toBe("#000");
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining({ id: "A", isDeleted: true }),
        expect.objectContaining({ id: "B", isDeleted: false }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: true }),
        expect.objectContaining({ id: "B", isDeleted: false }),
      ]);
    });

    it("should support appstate name or viewBackgroundColor change", async () => {
      const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
      await render(
        <Excalidraw
          excalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
          handleKeyboardGlobally={true}
          initialData={{
            appState: {
              name: "Old name",
              viewBackgroundColor: "#FFF",
            },
          }}
        />,
      );
      const excalidrawAPI = await excalidrawAPIPromise;

      excalidrawAPI.updateScene({
        appState: {
          name: "New name",
        },
        commitToStore: true,
      });

      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.name).toBe("New name");

      excalidrawAPI.updateScene({
        appState: {
          viewBackgroundColor: "#000",
        },
        commitToStore: true,
      });
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.name).toBe("New name");
      expect(h.state.viewBackgroundColor).toBe("#000");

      // just to double check that same change is not recorded
      excalidrawAPI.updateScene({
        appState: {
          name: "New name",
          viewBackgroundColor: "#000",
        },
        commitToStore: true,
      });
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.name).toBe("New name");
      expect(h.state.viewBackgroundColor).toBe("#000");

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.name).toBe("New name");
      expect(h.state.viewBackgroundColor).toBe("#FFF");

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(2);
      expect(h.state.name).toBe("Old name");
      expect(h.state.viewBackgroundColor).toBe("#FFF");

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.name).toBe("New name");
      expect(h.state.viewBackgroundColor).toBe("#FFF");

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.name).toBe("New name");
      expect(h.state.viewBackgroundColor).toBe("#000");
    });

    it("should support element creation, deletion and appstate element selection change", async () => {
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

    it("should support linear element creation and points manipulation through the editor", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      // create three point arrow
      UI.clickTool("arrow");
      mouse.click(0, 0);
      mouse.click(10, 10);
      mouse.click(10, -10);

      // actionFinalize
      Keyboard.keyPress(KEYS.ENTER);

      // open editor
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ENTER);
      });

      // move point
      mouse.downAt(20, 0);
      mouse.moveTo(20, 20);
      mouse.up();

      // leave editor
      Keyboard.keyPress(KEYS.ESCAPE);

      expect(API.getUndoStack().length).toBe(6);
      expect(API.getRedoStack().length).toBe(0);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull();
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 20],
          ],
        }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(5);
      expect(API.getRedoStack().length).toBe(1);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.state.selectedLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 20],
          ],
        }),
      ]);

      // making sure clicking on points in the editor does not generate new history entries!
      mouse.clickAt(0, 0);
      mouse.clickAt(10, 10);
      mouse.clickAt(20, 20);
      expect(API.getUndoStack().length).toBe(5);
      expect(API.getRedoStack().length).toBe(1);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(2);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.state.selectedLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(3);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull(); // undo `open editor`
      expect(h.state.selectedLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(4);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull(); // undo `actionFinalize`
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(5);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull();
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
          ],
        }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(6);
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull();
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: true,
          points: [
            [0, 0],
            [10, 10],
          ],
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(5);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull();
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
          ],
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(4);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull(); // undo `actionFinalize`
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(3);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull(); // undo `open editor`
      expect(h.state.selectedLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(2);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.state.selectedLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(5);
      expect(API.getRedoStack().length).toBe(1);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.state.selectedLinearElement?.elementId).toBe(h.elements[0].id);
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 20],
          ],
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(6);
      expect(API.getRedoStack().length).toBe(0);
      expect(assertSelectedElements(h.elements[0]));
      expect(h.state.editingLinearElement).toBeNull();
      expect(h.state.selectedLinearElement).toBeNull();
      expect(h.elements).toEqual([
        expect.objectContaining({
          isDeleted: false,
          points: [
            [0, 0],
            [10, 10],
            [20, 20],
          ],
        }),
      ]);
    });

    it("should support duplication of groups, appstate group selection and editing group", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const rect1 = API.createElement({
        type: "rectangle",
        groupIds: ["A"],
        x: 0,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        groupIds: ["A"],
        x: 100,
      });

      h.elements = [rect1, rect2];
      mouse.select(rect1);
      assertSelectedElements([rect1, rect2]);
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).toEqual({ A: true });

      // inside the editing group
      mouse.doubleClickOn(rect2);
      assertSelectedElements([rect2]);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBe("A");
      expect(h.state.selectedGroupIds).not.toEqual({ A: true });

      mouse.clickOn(rect1);
      assertSelectedElements([rect1]);
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBe("A");
      expect(h.state.selectedGroupIds).not.toEqual({ A: true });

      Keyboard.undo();
      assertSelectedElements([rect2]);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.editingGroupId).toBe("A");
      expect(h.state.selectedGroupIds).not.toEqual({ A: true });

      Keyboard.undo();
      assertSelectedElements([rect1, rect2]);
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).toEqual({ A: true });

      Keyboard.redo();
      assertSelectedElements([rect2]);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.editingGroupId).toBe("A");
      expect(h.state.selectedGroupIds).not.toEqual({ A: true });

      Keyboard.redo();
      assertSelectedElements([rect1]);
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBe("A");
      expect(h.state.selectedGroupIds).not.toEqual({ A: true });

      Keyboard.undo();
      assertSelectedElements([rect2]);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.editingGroupId).toBe("A");
      expect(h.state.selectedGroupIds).not.toEqual({ A: true });

      Keyboard.undo();
      assertSelectedElements([rect1, rect2]);
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).toEqual({ A: true });

      // outside the editing group, testing duplication
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress("d");
      });
      assertSelectedElements([h.elements[2], h.elements[3]]);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements.length).toBe(4);
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).not.toEqual(
        expect.objectContaining({ A: true }),
      );

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements.length).toBe(4);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
        expect.objectContaining({ id: `${rect1.id}_copy`, isDeleted: true }),
        expect.objectContaining({ id: `${rect2.id}_copy`, isDeleted: true }),
      ]);
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).toEqual({ A: true });

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements.length).toBe(4);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
        expect.objectContaining({ id: `${rect1.id}_copy`, isDeleted: false }),
        expect.objectContaining({ id: `${rect2.id}_copy`, isDeleted: false }),
      ]);
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).not.toEqual(
        expect.objectContaining({ A: true }),
      );

      // undo again, and duplicate once more
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress("z");
        Keyboard.keyPress("d");
      });
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
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
      expect(h.state.editingGroupId).toBeNull();
      expect(h.state.selectedGroupIds).not.toEqual(
        expect.objectContaining({ A: true }),
      );
    });

    it("should support changes in elements' order", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const rect1 = UI.createElement("rectangle", { x: 10 });
      const rect2 = UI.createElement("rectangle", { x: 20, y: 20 });
      const rect3 = UI.createElement("rectangle", { x: 40, y: 40 });

      act(() => h.app.actionManager.executeAction(actionSendBackward));

      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect3);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements(rect3);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect3);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect2.id }),
      ]);

      mouse.select([rect1, rect3]);
      expect(API.getUndoStack().length).toBe(6);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect1, rect3]);

      act(() => h.app.actionManager.executeAction(actionBringForward));

      expect(API.getUndoStack().length).toBe(7);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect1, rect3]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(6);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements([rect1, rect3]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect2.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(7);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect1, rect3]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);
    });
  });

  describe("multiplayer undo/redo", () => {
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

    it("should not override remote changes on different elements", () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      expect(API.getUndoStack().length).toBe(2);

      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
      ]);

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

    it("should not override remote changes on different properties", () => {
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
    // This is due to the fact that deltas are updated in `applyLatestChanges`.
    it("should update history entries after remote changes on the same properties", async () => {
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

    it("should redistribute deltas when the removed locally but restored remotely", async () => {
      UI.createElement("rectangle", { x: 10 });
      Keyboard.keyDown(KEYS.DELETE);

      expect(API.getUndoStack().length).toBe(2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: transparent,
          isDeleted: true,
        }),
      ]);

      // Simulate remote update & restore
      excalidrawAPI.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: yellow,
            isDeleted: false, // undeletion might happen due to concurrency between clients
          }),
        ],
      });

      expect(API.getSelectedElements()).toEqual([]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow,
          isDeleted: false,
        }),
      ]);

      // inserted.isDeleted: true is updated with the latest changes to false
      // deleted.isDeleted and inserted.isDeleted are the same and therefore removed delta becomes an updated delta
      Keyboard.undo();
      expect(assertSelectedElements(h.elements[0]));
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow,
          isDeleted: false,
        }),
      ]);

      Keyboard.undo();
      expect(API.getSelectedElements()).toEqual([]);
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow,
          isDeleted: true,
        }),
      ]);

      Keyboard.redo();
      expect(assertSelectedElements(h.elements[0]));
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow,
          isDeleted: false,
        }),
      ]);

      Keyboard.redo();
      expect(assertSelectedElements([]));
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow,
          isDeleted: false, // isDeleted got updated
        }),
      ]);
    });

    it("should iterate through the history when when element change relates to remotely deleted element", async () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      expect(API.getUndoStack().length).toBe(2);

      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
      ]);

      // Simulate remote update & deletion
      excalidrawAPI.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: yellow,
            isDeleted: true,
          }),
        ],
      });

      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow,
          isDeleted: true,
        }),
      ]);

      // Will iterate through undo stack since applying the change
      // results in no visible change on a deleted element
      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: transparent,
          isDeleted: true,
        }),
      ]);

      // We reached the bottom, again we iterate through invisible changes and reach the top
      Keyboard.redo();
      assertSelectedElements();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow, // the color still get's updated
          isDeleted: true, // but the element remains deleted
        }),
      ]);
    });

    it("should iterate through the history when element changes relate only to remotely deleted elements", async () => {
      const rect1 = UI.createElement("rectangle", { x: 10 });

      const rect2 = UI.createElement("rectangle", { x: 20 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      const rect3 = UI.createElement("rectangle", { x: 30, y: 30 });

      // move rect3
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
          isDeleted: false,
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
      expect(API.getSelectedElements()).toEqual([]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          isDeleted: false,
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
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);

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
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      // do not expect any selectedElementIds, as all relate to deleted elements
      expect(API.getSelectedElements()).toEqual([]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: true }),
        expect.objectContaining({ id: rect3.id, isDeleted: true }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
      ]);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: false,
          }),
          newElementWith(h.elements[2], {
            isDeleted: false,
          }),
        ],
      });

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      // now we again expect these as selected, as they got restored remotely
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
        expect.objectContaining({ id: rect3.id, isDeleted: false }),
      ]);
    });

    it("should iterate through the history when z-index changes do not produce visible change", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 });
      const rect2 = API.createElement({ type: "rectangle", x: 20, y: 20 });
      const rect3 = API.createElement({ type: "rectangle", x: 30, y: 30 });

      h.elements = [rect1, rect2, rect3];

      mouse.select(rect2);

      act(() => h.app.actionManager.executeAction(actionSendToBack));

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          h.elements[2], // rect3
          h.elements[0], // rect2
          h.elements[1], // rect1
        ],
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect1.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect1.id }),
      ]);

      // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [
          h.elements[1], // rect2
          h.elements[0], // rect3
          h.elements[2], // rect1
        ],
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(2); // now we iterated two steps back!
      assertSelectedElements([]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect1.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect1.id }),
      ]);

      // no-op
      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect1.id }),
      ]);
    });

    it("should not let remote changes to interfere with in progress freedraw", async () => {
      UI.clickTool("freedraw");
      mouse.down(10, 10);
      mouse.moveTo(30, 30);

      const rectProps = {
        type: "rectangle",
        strokeColor: blue,
      } as const;

      // Simulate remote update
      const rect = API.createElement({ ...rectProps });

      // Simulate remote update
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
        expect.objectContaining(rectProps),
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
        expect.objectContaining(rectProps),
      ]);
    });

    it("should not let remote changes to interfere with in progress resizing", async () => {
      const props1 = { x: 10, y: 10, width: 10, height: 10 };
      const rect1 = UI.createElement("rectangle", { ...props1 });

      mouse.downAt(20, 20);
      mouse.moveTo(40, 40);

      assertSelectedElements(rect1);
      expect(API.getUndoStack().length).toBe(1);

      const rect3Props = {
        type: "rectangle",
        strokeColor: blue,
      } as const;

      const rect3 = API.createElement({ ...rect3Props });

      // // Simulate remote update
      excalidrawAPI.updateScene({
        elements: [...h.elements, rect3],
      });

      mouse.moveTo(100, 100);
      mouse.up();

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          ...props1,
          isDeleted: false,
          width: 90,
          height: 90,
        }),
        expect.objectContaining(rect3Props),
      ]);

      Keyboard.undo();
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          ...props1,
          isDeleted: false,
        }),
        expect.objectContaining(rect3Props),
      ]);

      Keyboard.undo();
      expect(API.getSelectedElements()).toEqual([]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          ...props1,
          isDeleted: true,
        }),
        expect.objectContaining(rect3Props),
      ]);

      Keyboard.redo();
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          ...props1,
          isDeleted: false,
        }),
        expect.objectContaining(rect3Props),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements(rect1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
          ...props1,
          isDeleted: false,
          width: 90,
          height: 90,
        }),
        expect.objectContaining(rect3Props),
      ]);
    });

    it("should not let remote changes to interfere with in progress dragging", async () => {
      const rect1 = UI.createElement("rectangle", { x: 10, y: 10 });
      const rect2 = UI.createElement("rectangle", { x: 30, y: 30 });

      mouse.select([rect1, rect2]);
      mouse.downAt(20, 20);
      mouse.moveTo(50, 50);

      assertSelectedElements(rect1, rect2);
      expect(API.getUndoStack().length).toBe(4);

      const rect3Props = {
        type: "rectangle",
        strokeColor: blue,
      } as const;

      const rect3 = API.createElement({ ...rect3Props });

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
        expect.objectContaining(rect3Props),
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
        expect.objectContaining(rect3Props),
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
        expect.objectContaining(rect3Props),
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
        expect.objectContaining(rect3Props),
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
        expect.objectContaining(rect3Props),
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
        expect.objectContaining(rect3Props),
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
        expect.objectContaining(rect3Props),
      ]);
    });

    describe("conflicts in bound text elements and containers", () => {
      let container: ExcalidrawGenericElement;
      let text: ExcalidrawTextElement;

      const containerProps = {
        type: "rectangle",
        width: 100,
        x: 10,
        y: 10,
        angle: 0,
      } as const;

      const textProps = {
        type: "text",
        text: "que pasa",
        x: 15,
        y: 15,
        angle: 0,
      } as const;

      // Util to check that we end up in the same state after series of undo / redo
      function runTwice(callback: () => void) {
        for (let i = 0; i < 2; i++) {
          callback();
        }
      }

      beforeEach(() => {
        container = API.createElement({ ...containerProps });
        text = API.createElement({ ...textProps });
      });

      it("should rebind bindings when both are updated through the history and there are other non-conflicting changes in the meantime", async () => {
        // Initialize the scene
        excalidrawAPI.updateScene({
          elements: [container, text],
        });

        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          commitToStore: true,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [],
            isDeleted: false,
          }),
          expect.objectContaining({
            id: text.id,
            containerId: null,
            isDeleted: false,
          }),
        ]);

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              // no conflicting updates
              x: h.elements[1].x + 20,
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              // no conflicting updates
              x: h.elements[1].x + 10,
            }),
          ],
        });

        runTwice(() => {
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: container.id,
              isDeleted: false,
            }),
          ]);

          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: null,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should rebind bindings when both are updated through the history and the container got bound to a different text in the meantime", async () => {
        // Initialize the scene
        excalidrawAPI.updateScene({
          elements: [container, text],
        });

        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          commitToStore: true,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [],
            isDeleted: false,
          }),
          expect.objectContaining({
            id: text.id,
            containerId: null,
            isDeleted: false,
          }),
        ]);

        const remoteText = API.createElement({
          type: "text",
          text: "ola",
          containerId: container.id,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: remoteText.id, type: "text" }],
            }),
            remoteText,
            h.elements[1],
          ],
        });

        runTwice(() => {
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              // last added was `text.id`, removing `remoteText.id`
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteText.id,
              // unbound as `remoteText.id` was removed
              containerId: null,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              // rebound!
              containerId: container.id,
              isDeleted: false,
            }),
          ]);

          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteText.id,
              containerId: container.id,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: null,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should rebind bindings when both are updated through the history and the text got bound to a different container in the meantime", async () => {
        // Initialize the scene
        excalidrawAPI.updateScene({
          elements: [container, text],
        });

        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          commitToStore: true,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [],
            isDeleted: false,
          }),
          expect.objectContaining({
            id: text.id,
            containerId: null,
            isDeleted: false,
          }),
        ]);

        const remoteContainer = API.createElement({
          type: "rectangle",
          width: 50,
          x: 100,
          boundElements: [{ id: text.id, type: "text" }],
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            h.elements[0],
            newElementWith(remoteContainer, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: remoteContainer.id,
            }),
          ],
        });

        runTwice(() => {
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              // rebound the text as we captured the full bidirectional binding in history!
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteContainer.id,
              // previous binding got unbound, as text is no longer bound to this element
              boundElements: [],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              // rebound!
              containerId: container.id,
              isDeleted: false,
            }),
          ]);

          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              // deleted binding (already during applyDelta)
              boundElements: [],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteContainer.id,
              // #2 due to restored binding in #1, we could rebind the remote container!
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              // #1 due to applying latest changes to the history entries, we could restore this binding
              containerId: remoteContainer.id,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should unbind/rebind remotely added bound text when it's container is removed/added through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [container],
          commitToStore: true,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, { containerId: container.id }),
          ],
        });

        runTwice(() => {
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              ...containerProps,
              id: container.id,
              // binding from deleted to non deleted is correct!
              // so that we could restore the bindings on history actions (subsequent redo in this case)
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: true,
            }),
            expect.objectContaining({
              ...textProps,
              id: text.id,
              // we trigger unbind - binding from non deleted to deleted cannot exist!
              containerId: null,
              isDeleted: false,
            }),
          ]);

          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              ...containerProps,
              id: container.id,
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              ...textProps,
              id: text.id,
              // we triggered rebind!
              containerId: container.id,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should unbind/rebind remotely added container when it's bound text is removed/added through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [text],
          commitToStore: true,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, { containerId: container.id }),
          ],
        });

        runTwice(() => {
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              ...containerProps,
              id: container.id,
              // we trigged unbind - bindings from non deleted to deleted cannot exist!
              boundElements: [],
              isDeleted: false,
            }),
            expect.objectContaining({
              ...textProps,
              // binding from deleted to non deleted is correct, so that we could restore the bindings on history actions
              containerId: container.id,
              id: text.id,
              isDeleted: true,
            }),
          ]);

          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              ...containerProps,
              id: container.id,
              // we triggered rebind!
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              ...textProps,
              containerId: container.id,
              id: text.id,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should preserve latest remotely added binding and unbind previous one when the container is added through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [container],
          commitToStore: true,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              containerId: container.id,
            }),
          ],
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: true,
          }),
          expect.objectContaining({
            id: text.id,
            // unbound!
            containerId: null,
            isDeleted: false,
          }),
        ]);

        const remoteText = API.createElement({
          type: "text",
          text: "ola",
          containerId: container.id,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false, // purposefully undeleting, mimicing concurrenct update
            }),
            h.elements[1],
            // rebinding the container with a new text element!
            remoteText,
          ],
        });

        runTwice(() => {
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              // previously bound text is preserved
              // text bindings are not duplicated
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              // unbound
              containerId: null,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteText.id,
              // preserved existing binding!
              containerId: container.id,
              isDeleted: false,
            }),
          ]);

          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false, // isDeleted got remotely updated to false
            }),
            expect.objectContaining({
              id: text.id,
              containerId: null,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteText.id,
              // unbound
              containerId: container.id,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should preserve latest remotely added binding and unbind previous one when the text is added through history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [text],
          commitToStore: true,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[0] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            // unbind affected bindable element
            boundElements: [],
            isDeleted: false,
          }),
          expect.objectContaining({
            id: text.id,
            containerId: container.id,
            isDeleted: true,
          }),
        ]);

        const remoteText = API.createElement({
          type: "text",
          text: "ola",
          containerId: container.id,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: remoteText.id, type: "text" }],
            }),
            h.elements[1],
            newElementWith(remoteText as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
        });

        runTwice(() => {
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              // previously bound text is preserved
              // text bindings are not duplicated
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              // unbound from container!
              containerId: null,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: remoteText.id,
              // preserved existing binding!
              containerId: container.id,
              isDeleted: false,
            }),
          ]);

          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: container.id,
              isDeleted: true,
            }),
            expect.objectContaining({
              id: remoteText.id,
              containerId: container.id,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should unbind remotely deleted bound text from container when the container is added through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [container],
          commitToStore: true,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              containerId: container.id,
              isDeleted: true,
            }),
          ],
        });

        runTwice(() => {
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: container.id,
              isDeleted: true,
            }),
          ]);

          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              // unbound!
              boundElements: [],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: container.id,
              isDeleted: true,
            }),
          ]);
        });
      });

      it("should unbind remotely deleted container from bound text when the text is added through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [text],
          commitToStore: true,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: true,
            }),
            newElementWith(h.elements[0] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
        });

        runTwice(() => {
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: container.id,
              isDeleted: true,
            }),
          ]);

          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: container.id,
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: text.id,
              // unbound!
              containerId: null,
              isDeleted: false,
            }),
          ]);
        });
      });

      it("should redraw remotely added bound text when it's container is updated through the history", async () => {
        // Initialize the scene
        excalidrawAPI.updateScene({
          elements: [container],
        });

        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 200,
              y: 200,
              angle: 90,
            }),
          ],
          commitToStore: true,
        });

        Keyboard.undo();

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, { containerId: container.id }),
          ],
        });

        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            x: 200,
            y: 200,
            angle: 90,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            // text element got redrawn!
            x: 205,
            y: 205,
            angle: 90,
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        // both elements got redrawn!
        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        // both elements got redrawn!
        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            x: 200,
            y: 200,
            angle: 90,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            x: 205,
            y: 205,
            angle: 90,
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);
      });

      // TODO: #7348 this leads to empty undo/redo and could be confusing - instead we might consider redrawing container based on the text dimensions
      it("should redraw bound text to match container dimensions when the bound text is updated through the history", async () => {
        // Initialize the scene
        excalidrawAPI.updateScene({
          elements: [text],
        });

        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 205,
              y: 205,
              angle: 90,
            }),
          ],
          commitToStore: true,
        });

        Keyboard.undo();

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[0] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
        });

        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            // bound text got redrawn, as redraw is triggered based on container positon!
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        // both elements got redrawn!
        expect(h.elements).toEqual([
          expect.objectContaining({
            ...containerProps,
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            id: text.id,
            containerId: container.id,
            isDeleted: false,
          }),
        ]);
      });
    });
  });
});
