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

describe("history", () => {
  beforeEach(() => {
    renderStaticScene.mockClear();
  });

  afterEach(() => {
    checkpoint("end of test");
  });

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

  it("undo/redo supports basic element creation, selection and deletion", async () => {
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

  it("undo/redo supports z-index actions", async () => {
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

  it("should clear the redo stack on a new history entry", async () => {
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
    expect(API.getRedoStack().length).toBe(0);
    expect(API.getSnapshot()).toEqual([
      // From now on this element is garbage, which we might want to collect,
      // unless it was created by someone else, who would like to restore it back
      expect.objectContaining({ id: rect1.id, isDeleted: true }),
      expect.objectContaining({ id: rect2.id, isDeleted: false }),
    ]);
    expect(h.elements).toEqual([
      expect.objectContaining({ id: rect1.id, isDeleted: true }),
      expect.objectContaining({ id: rect2.id, isDeleted: false }),
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
    // This is due to the fact that updated deltas are updated in `applyLatestChanges`.
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

    // This is due to the fact that added deltas don't get updated in `applyLatestChanges`.
    it("should allow the element author to restore his remotely deleted element", async () => {
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

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: transparent,
          isDeleted: false, // ...and we have the element back!
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: yellow, // ..now even with the latest color
          isDeleted: false,
        }),
      ]);
    });

    // This is due to the fact that removed deltas don't get updated in `applyLatestChanges`.
    it("should allow the element author to restore the element he deleted back to the state at the time of removal", async () => {
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

      Keyboard.undo();
      expect(assertSelectedElements(h.elements[0])); // undo stops here because of selection
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
          backgroundColor: transparent,
          isDeleted: false,
        }),
      ]);

      // We do not expect our `backgroundColor` to be updated into `yellow`,
      // to allow to get to the same point the element was at the time of the removal.
      Keyboard.redo();
      expect(API.getSelectedElements()).toEqual([]);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          backgroundColor: transparent,
          isDeleted: true,
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

      // Note: if one created the elements which were deleted remotely, he can always restore them through a redo stack
      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(3);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
        }),
        expect.objectContaining({
          id: rect2.id,
          isDeleted: false,
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
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(2);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
        }),
        expect.objectContaining({
          id: rect2.id,
          isDeleted: false,
          backgroundColor: red,
        }),
        expect.objectContaining({
          id: rect3.id,
          isDeleted: true,
          x: 30,
          y: 30,
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect3.id }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: rect1.id,
        }),
        expect.objectContaining({
          id: rect2.id,
          isDeleted: false,
          backgroundColor: red,
        }),
        expect.objectContaining({
          id: rect3.id,
          isDeleted: false,
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
          isDeleted: false,
          backgroundColor: red,
        }),
        expect.objectContaining({
          id: rect3.id,
          isDeleted: false,
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
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect3.id }),
        expect.objectContaining({ id: rect2.id }),
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

      const textProps = {
        type: "text",
        text: "que pasa",
        x: 15,
        y: 15,
        angle: 0,
      } as const;

      beforeEach(() => {
        container = API.createElement({
          type: "rectangle",
          width: 100,
          x: 10,
          y: 10,
          angle: 0,
        });

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [container],
        });

        text = API.createElement({ ...textProps, containerId: container.id });
      });

      it("should remove remotely added bound text when it's container is removed through the history", async () => {
        // Simulate local update and deletion
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 200,
              y: 200,
              angle: 180,
              isDeleted: true,
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
            x: 10,
            y: 10,
            angle: 0,
            isDeleted: false,
          }),
        ]);

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            text,
          ],
        });

        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            x: 10,
            y: 10,
            angle: 0,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            id: text.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            x: 200,
            y: 200,
            angle: 180,
            isDeleted: true,
          }),
          expect.objectContaining({
            ...textProps, // we don't expect the text props to get updated when it's deleted
            containerId: container.id,
            id: text.id,
            isDeleted: true,
          }),
        ]);
      });

      it("should restore remotely added bound text when it's container is added through the history", async () => {
        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              x: 200,
              y: 200,
              angle: 180,
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              // purposefully adding as deleted as it would be immediately undone and not having updated x, y, angle
              isDeleted: true,
            }),
          ],
        });

        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            x: 200,
            y: 200,
            angle: 180,
            boundElements: [{ id: text.id, type: "text" }],
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            id: text.id,
          }),
        ]);

        // Simulate local deletion
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              isDeleted: true, // purposefully adding as deleted as it would be immediately undone
            }),
            newElementWith(h.elements[1], {
              isDeleted: true, // purposefully adding as deleted as it would be immediately undone
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
            x: 200,
            y: 200,
            angle: 180,
            boundElements: [{ id: text.id, type: "text" }],
          }),
          expect.objectContaining({
            id: text.id,
            containerId: container.id,
            x: 205,
            y: 205,
            angle: 180,
          }),
        ]);
      });

      it("should restore remotely deleted container when it's bound text element is updated through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            text,
          ],
          commitToStore: true,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: null,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: null,
            id: text.id,
            isDeleted: true,
          }),
        ]);

        // Simulate remote update and deletion
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 200,
              y: 200,
              angle: 90,
              isDeleted: true,
            }),
            h.elements[1],
          ],
        });

        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: null,
            x: 200,
            y: 200,
            angle: 90,
            isDeleted: true,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: null,
            id: text.id,
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
            x: 200,
            y: 200,
            angle: 90,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            x: 205,
            y: 205,
            angle: 90,
            id: text.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: null,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: null,
            x: 205,
            y: 205,
            angle: 90,
            id: text.id,
            isDeleted: true,
          }),
        ]);
      });

      it("should unbind existing text elements when bound text element is added through the history", async () => {
        const localText = API.createElement({
          type: "text",
          text: "ola",
          containerId: container.id,
        });

        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: localText.id, type: "text" }],
            }),
            localText,
          ],
          commitToStore: true,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: null,
            isDeleted: false,
          }),
          expect.objectContaining({
            id: localText.id,
            containerId: null,
            isDeleted: true,
          }),
        ]);

        // Simulate remotely replacing the text
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [
                { id: "any", type: "arrow" }, // adding random arrow to see if it will be preserved
                { id: text.id, type: "text" },
              ],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: null,
              isDeleted: true,
            }),
            text,
          ],
        });

        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [
              { id: "any", type: "arrow" },
              { id: text.id, type: "text" },
            ],
            isDeleted: false,
          }),
          expect.objectContaining({
            id: localText.id,
            containerId: null,
            isDeleted: true,
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
            id: container.id,
            boundElements: [
              { id: "any", type: "arrow" },
              { id: localText.id, type: "text" },
            ],
            isDeleted: false,
          }),
          expect.objectContaining({
            id: localText.id,
            text: "ola",
            containerId: container.id,
            isDeleted: false,
          }),
          expect.objectContaining({
            id: text.id,
            text: "que pasa",
            containerId: null,
            isDeleted: true,
          }),
        ]);
      });

      it("should update remotely added bound text when it's container was updated through the history", async () => {
        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              isDeleted: true, // purposefully adding as deleted as it would be immediately undone
            }),
          ],
        });

        // Simulate local update, purposefully don't update text
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 30,
              y: 30,
              angle: 90,
            }),
            h.elements[1],
          ],
          commitToStore: true,
        });

        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            x: 30,
            y: 30,
            angle: 90,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            id: text.id,
            isDeleted: true,
          }),
        ]);

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            x: 10,
            y: 10,
            angle: 0,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            id: text.id,
            isDeleted: true,
          }),
        ]);

        // Simulate remote redo
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              isDeleted: false,
            }),
          ],
        });

        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            x: 10,
            y: 10,
            angle: 0,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            id: text.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: [{ id: text.id, type: "text" }],
            x: 30,
            y: 30,
            angle: 90,
            isDeleted: false,
          }),
          expect.objectContaining({
            containerId: container.id,
            id: text.id,
            isDeleted: false,
            x: 35,
            y: 35,
            angle: 90,
          }),
        ]);
      });

      it("should update bound text element when it's container was updated on remote after it's added through the history", async () => {
        // Simulate local update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            text,
          ],
          commitToStore: true,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: null,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: null,
            id: text.id,
            isDeleted: true,
          }),
        ]);

        // Simulate remote update
        excalidrawAPI.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 50,
              y: 50,
              angle: 45,
              height: 10,
            }),
            h.elements[1],
          ],
        });

        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: container.id,
            boundElements: null,
            x: 50,
            y: 50,
            angle: 45,
            height: 10,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: null,
            id: text.id,
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
            x: 50,
            y: 50,
            angle: 45,
            height: 35,
            isDeleted: false,
          }),
          expect.objectContaining({
            ...textProps,
            containerId: container.id,
            id: text.id,
            angle: 45,
            x: 55,
            y: 55,
            isDeleted: false,
          }),
        ]);
      });
    });
  });
});
