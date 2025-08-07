import React from "react";
import {
  queryByText,
  fireEvent,
  queryByTestId,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";
import { pointFrom } from "@excalidraw/math";

import { newElementWith } from "@excalidraw/element";

import {
  EXPORT_DATA_TYPES,
  MIME_TYPES,
  ORIG_ID,
  KEYS,
  arrayToMap,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  reseed,
} from "@excalidraw/common";

import "@excalidraw/utils/test-utils";

import { ElementsDelta, AppStateDelta } from "@excalidraw/element";

import { CaptureUpdateAction, StoreDelta } from "@excalidraw/element";

import type { LocalPoint, Radians } from "@excalidraw/math";

import type {
  ExcalidrawElbowArrowElement,
  ExcalidrawFrameElement,
  ExcalidrawGenericElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  FileId,
  FixedPointBinding,
  FractionalIndex,
  SceneElementsMap,
} from "@excalidraw/element/types";

import "../global.d.ts";

import {
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
} from "../actions";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";
import * as StaticScene from "../renderer/staticScene";
import { getDefaultAppState } from "../appState";
import { Excalidraw } from "../index";
import { createPasteEvent } from "../clipboard";

import * as blobModule from "../data/blob";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { mockHTMLImageElement } from "./helpers/mocks";
import {
  GlobalTestState,
  act,
  assertSelectedElements,
  render,
  togglePopover,
  getCloneByOrigId,
  checkpointHistory,
  unmountComponent,
} from "./test-utils";

import type { AppState } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const checkpoint = (name: string) => {
  expect(renderStaticScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );
  // `scrolledOutside` does not appear to be stable between test runs
  // `selectedLinearElemnt` includes `startBindingElement` containing seed and versionNonce
  const {
    name: _,
    scrolledOutside,
    selectedLinearElement,
    ...strippedAppState
  } = h.state;
  expect(strippedAppState).toMatchSnapshot(`[${name}] appState`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);

  h.elements
    .map(({ seed, versionNonce, ...strippedElement }) => strippedElement)
    .forEach((element, i) =>
      expect(element).toMatchSnapshot(`[${name}] element ${i}`),
    );

  checkpointHistory(h.history, name);
};

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

const transparent = COLOR_PALETTE.transparent;
const black = COLOR_PALETTE.black;
const red = COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];
const blue = COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];
const yellow = COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];
const violet = COLOR_PALETTE.violet[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX];

describe("history", () => {
  beforeEach(() => {
    unmountComponent();
    renderStaticScene.mockClear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    reseed(7);

    const generateIdSpy = vi.spyOn(blobModule, "generateIdFromFile");
    const resizeFileSpy = vi.spyOn(blobModule, "resizeImageFile");

    generateIdSpy.mockImplementation(() => Promise.resolve("fileId" as FileId));
    resizeFileSpy.mockImplementation((file: File) => Promise.resolve(file));

    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  afterEach(() => {
    checkpoint("end of test");
  });

  describe("singleplayer undo/redo", () => {
    it("should not collapse when applying corrupted history entry", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const rect = API.createElement({ type: "rectangle" });

      API.setElements([rect]);

      const corrupedEntry = StoreDelta.create(
        ElementsDelta.empty(),
        AppStateDelta.empty(),
      );

      vi.spyOn(corrupedEntry.elements, "applyTo").mockImplementation(() => {
        throw new Error("Oh no, I am corrupted!");
      });

      (h.history as any).undoStack.push(corrupedEntry);

      const appState = getDefaultAppState() as AppState;

      try {
        // due to this we unfortunately we couldn't do simple .toThrow()
        act(
          () =>
            h.history.undo(
              arrayToMap(h.elements) as SceneElementsMap,
              appState,
            ) as any,
        );
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
      // we popped the entry, even though it is corrupted, so the user could perform subsequent undo/redo and would not be stuck on this entry forever
      expect(API.getUndoStack().length).toBe(0);
      // we pushed the entr, as we don't want just lose it and throw it away - it might be perfectly valid on subsequent redo
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, isDeleted: false }), // no changes detected
      ]);

      try {
        // due to this we unfortunately we couldn't do simple .toThrow()
        act(
          () =>
            h.history.redo(
              arrayToMap(h.elements) as SceneElementsMap,
              appState,
            ) as any,
        );
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
      expect(API.getUndoStack().length).toBe(1); // vice versa for redo
      expect(API.getRedoStack().length).toBe(0); // vice versa for undo
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect.id, isDeleted: false }),
      ]);
    });

    it("should not end up with history entry when there are no appstate changes", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const rect1 = API.createElement({ type: "rectangle", groupIds: ["A"] });
      const rect2 = API.createElement({ type: "rectangle", groupIds: ["A"] });

      API.setElements([rect1, rect2]);
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
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle" });

      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);

      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY, // even though the flag is on, same elements are passed, nothing to commit
      });
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, isDeleted: false }),
        expect.objectContaining({ id: rect2.id, isDeleted: false }),
      ]);
    });

    it("should not modify anything on unrelated appstate change", async () => {
      const rect = API.createElement({ type: "rectangle" });
      await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          initialData={{
            elements: [rect],
          }}
        />,
      );

      API.updateScene({
        appState: {
          viewModeEnabled: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      await waitFor(() => {
        expect(h.state.viewModeEnabled).toBe(true);
        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({ id: rect.id, isDeleted: false }),
        ]);
        expect(h.store.snapshot.elements.get(rect.id)).toEqual(
          expect.objectContaining({ id: rect.id, isDeleted: false }),
        );
      });
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

      const undoAction = createUndoAction(h.history);
      const redoAction = createRedoAction(h.history);
      // noop
      API.executeAction(undoAction);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
      ]);
      const rectangle = UI.createElement("rectangle");
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: rectangle.id }),
      ]);
      API.executeAction(undoAction);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: rectangle.id, isDeleted: true }),
      ]);

      // noop
      API.executeAction(undoAction);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: rectangle.id, isDeleted: true }),
      ]);
      expect(API.getUndoStack().length).toBe(0);

      API.executeAction(redoAction);
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

      await API.drop(
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

      const undoAction = createUndoAction(h.history);
      const redoAction = createRedoAction(h.history);
      API.executeAction(undoAction);

      expect(API.getSnapshot()).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A", isDeleted: false }),
        expect.objectContaining({ id: "B", isDeleted: true }),
      ]);
      expect(h.state.viewBackgroundColor).toBe("#FFF");

      API.executeAction(redoAction);
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

    it("should create new history entry on image drag&drop", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      // it's necessary to specify the height in order to calculate natural dimensions of the image
      h.state.height = 1000;

      const deerImageDimensions = {
        width: 318,
        height: 335,
      };

      mockHTMLImageElement(
        deerImageDimensions.width,
        deerImageDimensions.height,
      );

      await API.drop(await API.loadFile("./fixtures/deer.png"));

      await waitFor(() => {
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            type: "image",
            fileId: expect.any(String),
            x: expect.toBeNonNaNNumber(),
            y: expect.toBeNonNaNNumber(),
            ...deerImageDimensions,
          }),
        ]);

        // need to check that delta actually contains initialized image element (with fileId & natural dimensions)
        expect(
          Object.values(h.history.undoStack[0].elements.removed)[0].deleted,
        ).toEqual(
          expect.objectContaining({
            type: "image",
            fileId: expect.any(String),
            x: expect.toBeNonNaNNumber(),
            y: expect.toBeNonNaNNumber(),
            ...deerImageDimensions,
          }),
        );
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "image",
          fileId: expect.any(String),
          x: expect.toBeNonNaNNumber(),
          y: expect.toBeNonNaNNumber(),
          isDeleted: true,
          ...deerImageDimensions,
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "image",
          fileId: expect.any(String),
          x: expect.toBeNonNaNNumber(),
          y: expect.toBeNonNaNNumber(),
          isDeleted: false,
          ...deerImageDimensions,
        }),
      ]);
    });

    it("should create new history entry on embeddable link drag&drop", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const link = "https://www.youtube.com/watch?v=gkGMXY0wekg";
      await API.drop(
        new Blob([link], {
          type: MIME_TYPES.text,
        }),
      );

      await waitFor(() => {
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            type: "embeddable",
            link,
          }),
        ]);
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "embeddable",
          link,
          isDeleted: true,
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "embeddable",
          link,
          isDeleted: false,
        }),
      ]);
    });

    it("should create new history entry on image paste", async () => {
      await render(
        <Excalidraw autoFocus={true} handleKeyboardGlobally={true} />,
      );

      // it's necessary to specify the height in order to calculate natural dimensions of the image
      h.state.height = 1000;

      const smileyImageDimensions = {
        width: 56,
        height: 77,
      };

      mockHTMLImageElement(
        smileyImageDimensions.width,
        smileyImageDimensions.height,
      );

      document.dispatchEvent(
        createPasteEvent({
          files: [await API.loadFile("./fixtures/smiley_embedded_v2.png")],
        }),
      );

      await waitFor(() => {
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            type: "image",
            fileId: expect.any(String),
            x: expect.toBeNonNaNNumber(),
            y: expect.toBeNonNaNNumber(),
            ...smileyImageDimensions,
          }),
        ]);
        // need to check that delta actually contains initialized image element (with fileId & natural dimensions)
        expect(
          Object.values(h.history.undoStack[0].elements.removed)[0].deleted,
        ).toEqual(
          expect.objectContaining({
            type: "image",
            fileId: expect.any(String),
            x: expect.toBeNonNaNNumber(),
            y: expect.toBeNonNaNNumber(),
            ...smileyImageDimensions,
          }),
        );
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "image",
          fileId: expect.any(String),
          x: expect.toBeNonNaNNumber(),
          y: expect.toBeNonNaNNumber(),
          isDeleted: true,
          ...smileyImageDimensions,
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "image",
          fileId: expect.any(String),
          x: expect.toBeNonNaNNumber(),
          y: expect.toBeNonNaNNumber(),
          isDeleted: false,
          ...smileyImageDimensions,
        }),
      ]);
    });

    it("should create new history entry on embeddable link paste", async () => {
      await render(
        <Excalidraw autoFocus={true} handleKeyboardGlobally={true} />,
      );

      const link = "https://www.youtube.com/watch?v=gkGMXY0wekg";

      document.dispatchEvent(
        createPasteEvent({
          types: {
            "text/plain": link,
          },
        }),
      );

      await waitFor(() => {
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            type: "embeddable",
            link,
          }),
        ]);
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "embeddable",
          link,
          isDeleted: true,
        }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          type: "embeddable",
          link,
          isDeleted: false,
        }),
      ]);
    });

    it("should support appstate name or viewBackgroundColor change", async () => {
      await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          initialData={{
            appState: {
              name: "Old name",
              viewBackgroundColor: "#FFF",
            },
          }}
        />,
      );

      expect(h.state.isLoading).toBe(false);
      expect(h.state.name).toBe("Old name");

      API.updateScene({
        appState: {
          name: "New name",
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.name).toBe("New name");

      API.updateScene({
        appState: {
          viewBackgroundColor: "#000",
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.name).toBe("New name");
      expect(h.state.viewBackgroundColor).toBe("#000");

      // just to double check that same change is not recorded
      API.updateScene({
        appState: {
          name: "New name",
          viewBackgroundColor: "#000",
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
      expect(h.state.selectedLinearElement).not.toBeNull();
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
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
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
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false); // undo `open editor`
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false); // undo `open editor`
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
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
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
      expect(h.state.selectedLinearElement?.isEditing).toBe(true);
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
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
      expect(h.state.selectedLinearElement).not.toBeNull();
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

    it("should create entry when selecting freedraw", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      UI.clickTool("rectangle");
      mouse.down(-10, -10);
      mouse.up(10, 10);

      UI.clickTool("freedraw");
      mouse.down(40, -20);
      mouse.up(50, 10);

      const rectangle = h.elements[0];
      const freedraw1 = h.elements[1];

      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rectangle.id }),
        expect.objectContaining({ id: freedraw1.id, strokeColor: black }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rectangle.id }),
        expect.objectContaining({
          id: freedraw1.id,
          strokeColor: black,
          isDeleted: true,
        }),
      ]);

      togglePopover("Stroke");
      UI.clickOnTestId("color-red");
      mouse.down(40, -20);
      mouse.up(50, 10);

      const freedraw2 = h.elements[2];

      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rectangle.id }),
        expect.objectContaining({
          id: freedraw1.id,
          strokeColor: black,
          isDeleted: true,
        }),
        expect.objectContaining({
          id: freedraw2.id,
          strokeColor: COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
        }),
      ]);

      // ensure we don't end up with duplicated entries
      UI.clickTool("freedraw");
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
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

      API.setElements([rect1, rect2]);
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
        expect.objectContaining({ [ORIG_ID]: rect1.id, isDeleted: true }),
        expect.objectContaining({ [ORIG_ID]: rect2.id, isDeleted: true }),
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
        expect.objectContaining({ [ORIG_ID]: rect1.id, isDeleted: false }),
        expect.objectContaining({ [ORIG_ID]: rect2.id, isDeleted: false }),
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
          expect.objectContaining({ [ORIG_ID]: rect1.id, isDeleted: true }),
          expect.objectContaining({ [ORIG_ID]: rect2.id, isDeleted: true }),
          expect.objectContaining({
            [ORIG_ID]: getCloneByOrigId(rect1.id)?.id,
            isDeleted: false,
          }),
          expect.objectContaining({
            [ORIG_ID]: getCloneByOrigId(rect2.id)?.id,
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

      API.executeAction(actionSendBackward);

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

      API.executeAction(actionBringForward);

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

    describe("should support bidirectional bindings", async () => {
      let rect1: ExcalidrawGenericElement;
      let rect2: ExcalidrawGenericElement;
      let text: ExcalidrawTextElement;
      let arrow: ExcalidrawLinearElement;

      const rect1Props = {
        type: "rectangle",
        height: 100,
        width: 100,
        x: -100,
        y: -50,
      } as const;

      const rect2Props = {
        type: "rectangle",
        height: 100,
        width: 100,
        x: 100,
        y: -50,
      } as const;

      const textProps = {
        type: "text",
        x: -200,
        text: "ola",
      } as const;

      beforeEach(async () => {
        await render(<Excalidraw handleKeyboardGlobally={true} />);

        rect1 = API.createElement({ ...rect1Props });
        text = API.createElement({ ...textProps });
        rect2 = API.createElement({ ...rect2Props });

        API.updateScene({
          elements: [rect1, text, rect2],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // bind text1 to rect1
        mouse.select([rect1, text]);
        fireEvent.contextMenu(GlobalTestState.interactiveCanvas);
        fireEvent.click(
          queryByText(
            document.querySelector(".context-menu") as HTMLElement,
            "Bind text to the container",
          )!,
        );

        expect(API.getUndoStack().length).toBe(4);
        expect(text.containerId).toBe(rect1.id);
        expect(rect1.boundElements).toStrictEqual([
          { id: text.id, type: "text" },
        ]);

        // bind arrow to rect1 and rect2
        UI.clickTool("arrow");
        mouse.down(0, 0);
        mouse.up(100, 0);

        arrow = h.elements[3] as ExcalidrawLinearElement;

        expect(API.getUndoStack().length).toBe(5);
        expect(arrow.startBinding).toEqual({
          elementId: rect1.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(arrow.endBinding).toEqual({
          elementId: rect2.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(rect1.boundElements).toStrictEqual([
          { id: text.id, type: "text" },
          { id: arrow.id, type: "arrow" },
        ]);
        expect(rect2.boundElements).toStrictEqual([
          { id: arrow.id, type: "arrow" },
        ]);
      });

      it("should unbind arrow from non deleted bindable elements on undo and rebind on redo", async () => {
        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(4);
        expect(API.getRedoStack().length).toBe(1);
        expect(arrow.startBinding).toEqual({
          elementId: rect1.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(arrow.endBinding).toEqual({
          elementId: rect2.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [{ id: text.id, type: "text" }],
          }),
          expect.objectContaining({ id: text.id }),
          expect.objectContaining({ id: rect2.id, boundElements: [] }),
          expect.objectContaining({ id: arrow.id, isDeleted: true }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(5);
        expect(API.getRedoStack().length).toBe(0);
        expect(arrow.startBinding).toEqual({
          elementId: rect1.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(arrow.endBinding).toEqual({
          elementId: rect2.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [
              { id: text.id, type: "text" },
              { id: arrow.id, type: "arrow" },
            ],
          }),
          expect.objectContaining({ id: text.id }),
          expect.objectContaining({
            id: rect2.id,
            boundElements: [{ id: arrow.id, type: "arrow" }],
          }),
          expect.objectContaining({ id: arrow.id, isDeleted: false }),
        ]);
      });

      it("should unbind arrow from non deleted bindable elements on deletion and rebind on undo", async () => {
        Keyboard.keyDown(KEYS.DELETE);
        expect(API.getUndoStack().length).toBe(6);
        expect(API.getRedoStack().length).toBe(0);
        expect(arrow.startBinding).toEqual({
          elementId: rect1.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(arrow.endBinding).toEqual({
          elementId: rect2.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [{ id: text.id, type: "text" }],
          }),
          expect.objectContaining({ id: text.id }),
          expect.objectContaining({ id: rect2.id, boundElements: [] }),
          expect.objectContaining({ id: arrow.id, isDeleted: true }),
        ]);

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(5);
        expect(API.getRedoStack().length).toBe(1);
        expect(arrow.startBinding).toEqual({
          elementId: rect1.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(arrow.endBinding).toEqual({
          elementId: rect2.id,
          focus: expect.toBeNonNaNNumber(),
          gap: expect.toBeNonNaNNumber(),
        });
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [
              { id: text.id, type: "text" },
              { id: arrow.id, type: "arrow" },
            ],
          }),
          expect.objectContaining({ id: text.id }),
          expect.objectContaining({
            id: rect2.id,
            boundElements: [{ id: arrow.id, type: "arrow" }],
          }),
          expect.objectContaining({ id: arrow.id, isDeleted: false }),
        ]);
      });

      it("should unbind everything from non deleted elements when iterating through the whole undo stack and vice versa rebind everything on redo", async () => {
        Keyboard.undo();
        Keyboard.undo();
        Keyboard.undo();
        Keyboard.undo();
        Keyboard.undo();

        expect(API.getUndoStack().length).toBe(0);
        expect(API.getRedoStack().length).toBe(5);
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: null,
              isDeleted: true,
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: arrow.id,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              isDeleted: true,
            }),
          ]),
        );

        Keyboard.redo();
        Keyboard.redo();
        Keyboard.redo();
        Keyboard.redo();
        Keyboard.redo();

        expect(API.getUndoStack().length).toBe(5);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: expect.arrayContaining([
                { id: text.id, type: "text" },
                { id: arrow.id, type: "arrow" },
              ]),
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: rect1.id,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrow.id, type: "arrow" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: arrow.id,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              isDeleted: false,
            }),
          ]),
        );
      });

      it("should unbind rectangle from arrow on deletion and rebind on undo", async () => {
        mouse.select(rect1);
        Keyboard.keyPress(KEYS.DELETE);
        expect(API.getUndoStack().length).toBe(7);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [
                { id: text.id, type: "text" },
                { id: arrow.id, type: "arrow" },
              ],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: rect1.id,
              isDeleted: true,
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrow.id, type: "arrow" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: arrow.id,
              startBinding: null,
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              isDeleted: false,
            }),
          ]),
        );

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(6);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: expect.arrayContaining([
                { id: arrow.id, type: "arrow" },
                { id: text.id, type: "text" }, // order has now changed!
              ]),
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: rect1.id,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrow.id, type: "arrow" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: arrow.id,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              isDeleted: false,
            }),
          ]),
        );
      });

      it("should unbind rectangles from arrow on deletion and rebind on undo", async () => {
        mouse.select([rect1, rect2]);
        Keyboard.keyPress(KEYS.DELETE);
        expect(API.getUndoStack().length).toBe(8);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [
              { id: text.id, type: "text" },
              { id: arrow.id, type: "arrow" },
            ],
            isDeleted: true,
          }),
          expect.objectContaining({
            id: text.id,
            containerId: rect1.id,
            isDeleted: true,
          }),
          expect.objectContaining({
            id: rect2.id,
            boundElements: [{ id: arrow.id, type: "arrow" }],
            isDeleted: true,
          }),
          expect.objectContaining({
            id: arrow.id,
            startBinding: null,
            endBinding: null,
            isDeleted: false,
          }),
        ]);

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(7);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: expect.arrayContaining([
                { id: arrow.id, type: "arrow" },
                { id: text.id, type: "text" }, // order has now changed!
              ]),
              isDeleted: false,
            }),
            expect.objectContaining({
              id: text.id,
              containerId: rect1.id,
              isDeleted: false,
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrow.id, type: "arrow" }],
              isDeleted: false,
            }),
            expect.objectContaining({
              id: arrow.id,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              isDeleted: false,
            }),
          ]),
        );
      });
    });

    it("should disable undo/redo buttons when stacks empty", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [API.createElement({ type: "rectangle", id: "A" })],
          }}
        />,
      );

      const undoAction = createUndoAction(h.history);
      const redoAction = createRedoAction(h.history);

      await waitFor(() => {
        expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
        expect(h.history.isUndoStackEmpty).toBeTruthy();
        expect(h.history.isRedoStackEmpty).toBeTruthy();
      });

      const undoButton = queryByTestId(container, "button-undo");
      const redoButton = queryByTestId(container, "button-redo");

      expect(undoButton).toBeDisabled();
      expect(redoButton).toBeDisabled();

      const rectangle = UI.createElement("rectangle");
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: rectangle.id }),
      ]);

      expect(h.history.isUndoStackEmpty).toBeFalsy();
      expect(h.history.isRedoStackEmpty).toBeTruthy();
      expect(undoButton).not.toBeDisabled();
      expect(redoButton).toBeDisabled();

      API.executeAction(undoAction);

      expect(h.history.isUndoStackEmpty).toBeTruthy();
      expect(h.history.isRedoStackEmpty).toBeFalsy();
      expect(undoButton).toBeDisabled();
      expect(redoButton).not.toBeDisabled();

      API.executeAction(redoAction);

      expect(h.history.isUndoStackEmpty).toBeFalsy();
      expect(h.history.isRedoStackEmpty).toBeTruthy();
      expect(undoButton).not.toBeDisabled();
      expect(redoButton).toBeDisabled();
    });

    it("remounting undo/redo buttons should initialize undo/redo state correctly", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [API.createElement({ type: "rectangle", id: "A" })],
          }}
        />,
      );

      const undoAction = createUndoAction(h.history);

      await waitFor(() => {
        expect(h.elements).toEqual([expect.objectContaining({ id: "A" })]);
        expect(h.history.isUndoStackEmpty).toBeTruthy();
        expect(h.history.isRedoStackEmpty).toBeTruthy();
      });

      expect(queryByTestId(container, "button-undo")).toBeDisabled();
      expect(queryByTestId(container, "button-redo")).toBeDisabled();

      // testing undo button
      // -----------------------------------------------------------------------

      const rectangle = UI.createElement("rectangle");
      expect(h.elements).toEqual([
        expect.objectContaining({ id: "A" }),
        expect.objectContaining({ id: rectangle.id }),
      ]);

      expect(h.history.isUndoStackEmpty).toBeFalsy();
      expect(h.history.isRedoStackEmpty).toBeTruthy();
      expect(queryByTestId(container, "button-undo")).not.toBeDisabled();
      expect(queryByTestId(container, "button-redo")).toBeDisabled();

      API.executeAction(actionToggleViewMode);
      expect(h.state.viewModeEnabled).toBe(true);

      expect(queryByTestId(container, "button-undo")).toBeNull();
      expect(queryByTestId(container, "button-redo")).toBeNull();

      API.executeAction(actionToggleViewMode);
      expect(h.state.viewModeEnabled).toBe(false);

      await waitFor(() => {
        expect(queryByTestId(container, "button-undo")).not.toBeDisabled();
        expect(queryByTestId(container, "button-redo")).toBeDisabled();
      });

      // testing redo button
      // -----------------------------------------------------------------------

      API.executeAction(undoAction);

      expect(h.history.isUndoStackEmpty).toBeTruthy();
      expect(h.history.isRedoStackEmpty).toBeFalsy();
      expect(queryByTestId(container, "button-undo")).toBeDisabled();
      expect(queryByTestId(container, "button-redo")).not.toBeDisabled();

      API.executeAction(actionToggleViewMode);
      expect(h.state.viewModeEnabled).toBe(true);

      expect(queryByTestId(container, "button-undo")).toBeNull();
      expect(queryByTestId(container, "button-redo")).toBeNull();

      API.executeAction(actionToggleViewMode);
      expect(h.state.viewModeEnabled).toBe(false);

      expect(h.history.isUndoStackEmpty).toBeTruthy();
      expect(h.history.isRedoStackEmpty).toBeFalsy();
      expect(queryByTestId(container, "button-undo")).toBeDisabled();
      expect(queryByTestId(container, "button-redo")).not.toBeDisabled();
    });
  });

  describe("multiplayer undo/redo", () => {
    // Util to check that we end up in the same state after series of undo / redo
    function runTwice(callback: () => void) {
      for (let i = 0; i < 2; i++) {
        callback();
      }
    }

    beforeEach(async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} isCollaborating={true} />,
      );
    });

    it("should not override remote changes on different elements", async () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      expect(API.getUndoStack().length).toBe(2);

      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
      ]);

      // Simulate remote update
      API.updateScene({
        elements: [
          ...h.elements,
          API.createElement({
            type: "rectangle",
            strokeColor: blue,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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

    it("should not override remote changes on different properties", async () => {
      UI.createElement("rectangle", { x: 10 });
      togglePopover("Background");
      UI.clickOnTestId("color-red");

      expect(API.getUndoStack().length).toBe(2);

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            strokeColor: yellow,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: yellow,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // At this point our entry gets updated from `red` -> `blue` into `red` -> `yellow`
      Keyboard.undo();
      expect(h.elements).toEqual([
        expect.objectContaining({ backgroundColor: red }),
      ]);

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: violet,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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

    it("should redraw arrows on undo", () => {
      const rect = API.createElement({
        type: "rectangle",
        id: "KPrBI4g_v9qUB1XxYLgSz",
        x: 873,
        y: 212,
        width: 157,
        height: 126,
      });
      const diamond = API.createElement({
        id: "u2JGnnmoJ0VATV4vCNJE5",
        type: "diamond",
        x: 1152,
        y: 516,
        width: 124,
        height: 129,
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "6Rm4g567UQM4WjLwej2Vc",
        elbowed: true,
      });

      API.updateScene({
        elements: [rect, diamond],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      // Connect the arrow
      API.updateScene({
        elements: [
          {
            ...rect,
            boundElements: [
              {
                id: "6Rm4g567UQM4WjLwej2Vc",
                type: "arrow",
              },
            ],
          },
          {
            ...diamond,
            boundElements: [
              {
                id: "6Rm4g567UQM4WjLwej2Vc",
                type: "arrow",
              },
            ],
          },
          {
            ...arrow,
            x: 1035,
            y: 274.9,
            width: 178.9000000000001,
            height: 236.10000000000002,
            points: [
              pointFrom(0, 0),
              pointFrom(178.9000000000001, 0),
              pointFrom(178.9000000000001, 236.10000000000002),
            ],
            startBinding: {
              elementId: "KPrBI4g_v9qUB1XxYLgSz",
              focus: -0.001587301587301948,
              gap: 5,
              fixedPoint: [1.0318471337579618, 0.49920634920634904],
            } as FixedPointBinding,
            endBinding: {
              elementId: "u2JGnnmoJ0VATV4vCNJE5",
              focus: -0.0016129032258049847,
              gap: 3.537079145500037,
              fixedPoint: [0.4991935483870975, -0.03875193720914723],
            } as FixedPointBinding,
          },
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      Keyboard.undo();

      API.updateScene({
        elements: h.elements.map((el) =>
          el.id === "KPrBI4g_v9qUB1XxYLgSz"
            ? {
                ...el,
                x: 600,
                y: 0,
              }
            : el,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo();

      const modifiedArrow = h.elements.filter(
        (el) => el.type === "arrow",
      )[0] as ExcalidrawElbowArrowElement;
      expect(modifiedArrow.points).toCloselyEqualPoints([
        [0, 0],
        [178.9, 0],
        [178.9, 236.1],
      ]);
    });

    // TODO: #7348 ideally we should not override, but since the order of groupIds matters, right now we cannot ensure that with postprocssed groupIds the order will be consistent after series or undos/redos, we don't postprocess them at all
    //       in other words, if we would postprocess groupIds, the groupIds order on "redo" below would be ["B", "A"] instead of ["A", "B"]
    it("should override remotely added groups on undo, but restore them on redo", async () => {
      const rect1 = API.createElement({ type: "rectangle" });
      const rect2 = API.createElement({ type: "rectangle" });

      // Initialize scene
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // Simulate local update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], { groupIds: ["A"] }),
          newElementWith(h.elements[1], { groupIds: ["A"] }),
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      const rect3 = API.createElement({ type: "rectangle", groupIds: ["B"] });
      const rect4 = API.createElement({ type: "rectangle", groupIds: ["B"] });

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], { groupIds: ["A", "B"] }),
          newElementWith(h.elements[1], { groupIds: ["A", "B"] }),
          rect3,
          rect4,
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, groupIds: [] }),
        expect.objectContaining({ id: rect2.id, groupIds: [] }),
        expect.objectContaining({ id: rect3.id, groupIds: ["B"] }),
        expect.objectContaining({ id: rect4.id, groupIds: ["B"] }),
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id, groupIds: ["A", "B"] }),
        expect.objectContaining({ id: rect2.id, groupIds: ["A", "B"] }),
        expect.objectContaining({ id: rect3.id, groupIds: ["B"] }),
        expect.objectContaining({ id: rect4.id, groupIds: ["B"] }),
      ]);
    });

    it("should override remotely added points on undo, but restore them on redo", async () => {
      UI.clickTool("arrow");
      mouse.click(0, 0);
      mouse.click(10, 10);
      mouse.click(20, 20);

      // actionFinalize
      Keyboard.keyPress(KEYS.ENTER);

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0] as ExcalidrawLinearElement, {
            points: [
              pointFrom(0, 0),
              pointFrom(5, 5),
              pointFrom(10, 10),
              pointFrom(15, 15),
              pointFrom(20, 20),
            ] as LocalPoint[],
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo(); // undo `actionFinalize`
      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(2);
      expect(h.elements).toEqual([
        expect.objectContaining({
          points: [
            [0, 0],
            // overriding all the remote points as they are not being postprocessed (as we cannot ensure the order consistency similar to groupIds)
            // but in this case it might not make even sense to combine the points, as in some cases the linear element might lead unexpected results
            [10, 10],
          ],
        }),
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(3);
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
      expect(API.getRedoStack().length).toBe(2);
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
      expect(API.getRedoStack().length).toBe(1);
      expect(h.elements).toEqual([
        expect.objectContaining({
          points: [
            [0, 0],
            [5, 5],
            [10, 10],
            [15, 15],
            [20, 20],
          ],
        }),
      ]);

      Keyboard.redo(); // redo `actionFinalize`
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({
          points: [
            [0, 0],
            [5, 5],
            [10, 10],
            [15, 15],
            [20, 20],
          ],
        }),
      ]);
    });

    it("should redistribute deltas when element gets removed locally but is restored remotely", async () => {
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
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: yellow,
            isDeleted: false, // undeletion might happen due to concurrency between clients
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            backgroundColor: yellow,
            isDeleted: true,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
          newElementWith(h.elements[2], {
            isDeleted: true,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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

    it("should iterate through the history when selected elements relate only to remotely deleted elements", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 });
      const rect2 = API.createElement({ type: "rectangle", x: 20, y: 20 });
      const rect3 = API.createElement({ type: "rectangle", x: 30, y: 30 });

      API.setElements([rect1, rect2, rect3]);
      mouse.select(rect1);
      mouse.select([rect2, rect3]);

      expect(API.getUndoStack().length).toBe(3);
      expect(API.getSelectedElements()).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);

      // Simulate remote update
      API.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
          newElementWith(h.elements[2], {
            isDeleted: true,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [
          h.elements[0],
          newElementWith(h.elements[1], {
            isDeleted: false,
          }),
          newElementWith(h.elements[2], {
            isDeleted: false,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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

    it("should iterate through the history when selected groups contain only remotely deleted elements", async () => {
      const rect1 = API.createElement({
        type: "rectangle",
        groupIds: ["A"],
      });
      const rect2 = API.createElement({
        type: "rectangle",
        groupIds: ["A"],
      });
      const rect3 = API.createElement({
        type: "rectangle",
        groupIds: ["B"],
      });
      const rect4 = API.createElement({
        type: "rectangle",
        groupIds: ["B"],
      });

      // Simulate remote update
      API.updateScene({
        elements: [rect1, rect2],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.A);
      });

      // Simulate remote update
      API.updateScene({
        elements: [h.elements[0], h.elements[1], rect3, rect4],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.A);
      });

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.selectedGroupIds).toEqual({ A: true, B: true });

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            isDeleted: true,
          }),
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(2); // iterated two steps back!
      expect(h.state.selectedGroupIds).toEqual({});

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2); // iterated two steps forward!
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.selectedGroupIds).toEqual({});

      Keyboard.undo();

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            isDeleted: false,
          }),
          newElementWith(h.elements[1], {
            isDeleted: false,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.selectedGroupIds).toEqual({ A: true });

      // Simulate remote update
      API.updateScene({
        elements: [h.elements[0], h.elements[1], rect3, rect4],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.selectedGroupIds).toEqual({ A: true, B: true });
    });

    it("should iterate through the history when editing group contains only remotely deleted elements", async () => {
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

      API.setElements([rect1, rect2]);
      mouse.select(rect1);

      // inside the editing group
      mouse.doubleClickOn(rect2);
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBe("A");

      mouse.clickAt(-10, -10);
      expect(API.getSelectedElements().length).toBe(0);
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBeNull();

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            isDeleted: true,
          }),
          newElementWith(h.elements[1], {
            isDeleted: true,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(3);
      expect(h.state.editingGroupId).toBeNull();

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBeNull();

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            isDeleted: false,
          }),
          h.elements[1],
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(1);
      expect(h.state.editingGroupId).toBe("A");

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(3);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.editingGroupId).toBeNull();
    });

    it("should iterate through the history when selected or editing linear element was remotely deleted", async () => {
      // create three point arrow
      UI.clickTool("arrow");
      mouse.click(0, 0);
      mouse.click(10, 10);

      // actionFinalize
      Keyboard.keyPress(KEYS.ENTER);

      // open editor
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ENTER);
      });

      // leave editor
      Keyboard.keyPress(KEYS.ESCAPE);

      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.selectedLinearElement).not.toBeNull();
      expect(h.state.selectedLinearElement?.isEditing).toBe(false);

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[0], {
            isDeleted: true,
          }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(4);
      expect(h.state.selectedLinearElement).toBeNull();

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(4);
      expect(API.getRedoStack().length).toBe(0);
      expect(h.state.selectedLinearElement).toBeNull();
      expect(h.state.selectedLinearElement?.isEditing ?? false).toBe(false);
    });

    it("should iterate through the history when z-index changes do not produce visible change and we synced changed indices", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 }); // a "a0"
      const rect2 = API.createElement({ type: "rectangle", x: 20, y: 20 }); // b "a1"
      const rect3 = API.createElement({ type: "rectangle", x: 30, y: 30 }); // c "a2"

      API.setElements([rect1, rect2, rect3]);

      mouse.select(rect2);

      API.executeAction(actionSendToBack);

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }), // b "Zz"
        expect.objectContaining({ id: rect1.id }), // a "a0"
        expect.objectContaining({ id: rect3.id }), // c "a2"
      ]);

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[2], { index: "Zy" as FractionalIndex }),
          h.elements[0],
          h.elements[1],
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect3.id }), // c "Zy"
        expect.objectContaining({ id: rect2.id }), // b "Zz"
        expect.objectContaining({ id: rect1.id }), // a "a0"
      ]);

      Keyboard.undo();
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect3.id }), // c "Zy"
        expect.objectContaining({ id: rect1.id }), // a "a0"
        expect.objectContaining({ id: rect2.id }), // b "a1"
      ]);

      Keyboard.redo();
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect3.id }), // c "Zy"
        expect.objectContaining({ id: rect2.id }), // b "Zz"
        expect.objectContaining({ id: rect1.id }), // a "a0"
      ]);

      // Simulate remote update
      API.updateScene({
        elements: [
          newElementWith(h.elements[2], { index: "Zx" as FractionalIndex }),
          h.elements[0],
          h.elements[1],
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id }), // a "Zx"
        expect.objectContaining({ id: rect3.id }), // c "Zy"
        expect.objectContaining({ id: rect2.id }), // b "Zz"
      ]);

      Keyboard.undo();
      // We iterated two steps as there was no change in order!
      expect(API.getUndoStack().length).toBe(0);
      expect(API.getRedoStack().length).toBe(2);
      expect(API.getSelectedElements().length).toBe(0);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect1.id }), // a "Zx"
        expect.objectContaining({ id: rect3.id }), // c "Zy"
        expect.objectContaining({ id: rect2.id }), // b "a1"
      ]);
    });

    it("should iterate through the history when z-index changes do not produce visible change and we synced all indices", async () => {
      const rect1 = API.createElement({ type: "rectangle", x: 10, y: 10 });
      const rect2 = API.createElement({ type: "rectangle", x: 20, y: 20 });
      const rect3 = API.createElement({ type: "rectangle", x: 30, y: 30 });

      API.setElements([rect1, rect2, rect3]);

      mouse.select(rect2);

      API.executeAction(actionSendToBack);

      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      assertSelectedElements([rect2]);
      expect(h.elements).toEqual([
        expect.objectContaining({ id: rect2.id }),
        expect.objectContaining({ id: rect1.id }),
        expect.objectContaining({ id: rect3.id }),
      ]);

      // Simulate remote update (fixes all invalid z-indices)
      API.updateScene({
        elements: [
          h.elements[2], // rect3
          h.elements[0], // rect2
          h.elements[1], // rect1
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [
          h.elements[1], // rect2
          h.elements[0], // rect3
          h.elements[2], // rect1
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [...h.elements, rect],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [...h.elements, rect3],
        captureUpdate: CaptureUpdateAction.NEVER,
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
      API.updateScene({
        elements: [...h.elements, rect3],
        captureUpdate: CaptureUpdateAction.NEVER,
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

    describe("conflicts in bound text elements and their containers", () => {
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

      beforeEach(() => {
        container = API.createElement({ ...containerProps });
        text = API.createElement({ ...textProps });
      });

      it("should rebind bindings when both are updated through the history and there no conflicting updates in the meantime", async () => {
        // Initialize the scene
        API.updateScene({
          elements: [container, text],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Simulate local update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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
        API.updateScene({
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
          captureUpdate: CaptureUpdateAction.NEVER,
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

      // TODO: #7348 we do rebind now, when we have bi-directional binding in history, to eliminate potential data-integrity issues, but we should consider not rebinding in the future
      it("should rebind bindings when both are updated through the history and the container got bound to a different text in the meantime", async () => {
        // Initialize the scene
        API.updateScene({
          elements: [container, text],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Simulate local update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: remoteText.id, type: "text" }],
            }),
            remoteText,
            h.elements[1],
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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

      // TODO: #7348 we do rebind now, when we have bi-directional binding in history, to eliminate potential data-integrity issues, but we should consider not rebinding in the future
      it("should rebind bindings when both are updated through the history and the text got bound to a different container in the meantime", async () => {
        // Initialize the scene
        API.updateScene({
          elements: [container, text],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Simulate local update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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
        API.updateScene({
          elements: [
            h.elements[0],
            newElementWith(remoteContainer, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[1] as ExcalidrawTextElement, {
              containerId: remoteContainer.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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

      it("should rebind remotely added bound text when it's container is added through the history", async () => {
        // Simulate local update
        API.updateScene({
          elements: [container],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, { containerId: container.id }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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

      it("should rebind remotely added container when it's bound text is added through the history", async () => {
        // Simulate local update
        API.updateScene({
          elements: [text],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, { containerId: container.id }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [container],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: remoteText.id, type: "text" }],
              isDeleted: false, // purposefully undeleting, mimicing concurrenct update
            }),
            h.elements[1],
            // rebinding the container with a new text element!
            remoteText,
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [text],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[0] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: remoteText.id, type: "text" }],
            }),
            h.elements[1],
            newElementWith(remoteText as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [container],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, {
              containerId: container.id,
              isDeleted: true,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [text],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
              isDeleted: true,
            }),
            newElementWith(h.elements[0] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [container],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Simulate local update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 200,
              y: 200,
              angle: 90 as Radians,
            }),
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        Keyboard.undo();

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(text, { containerId: container.id }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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
        API.updateScene({
          elements: [text],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Simulate local update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              x: 205,
              y: 205,
              angle: 90 as Radians,
            }),
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        Keyboard.undo();

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(container, {
              boundElements: [{ id: text.id, type: "text" }],
            }),
            newElementWith(h.elements[0] as ExcalidrawTextElement, {
              containerId: container.id,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
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

    describe("conflicts in arrows and their bindable elements", () => {
      let rect1: ExcalidrawGenericElement;
      let rect2: ExcalidrawGenericElement;

      const rect1Props = {
        type: "rectangle",
        height: 100,
        width: 100,
        x: -100,
        y: -50,
      } as const;

      const rect2Props = {
        type: "rectangle",
        height: 100,
        width: 100,
        x: 100,
        y: -50,
      } as const;

      function roundToNearestHundred(number: number) {
        return Math.round(number / 100) * 100;
      }

      beforeEach(() => {
        rect1 = API.createElement({ ...rect1Props });
        rect2 = API.createElement({ ...rect2Props });

        // Simulate local update
        API.updateScene({
          elements: [rect1, rect2],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        mouse.reset();
      });

      it("should rebind bindings when both are updated through the history and there are no conflicting updates in the meantime", async () => {
        // create arrow without bindings
        Keyboard.withModifierKeys({ ctrl: true }, () => {
          UI.clickTool("arrow");
          mouse.down(0, 0);
          mouse.up(100, 0);
        });

        const arrowId = h.elements[2].id;

        // create start binding
        mouse.downAt(0, 0);
        mouse.moveTo(0, 1);
        mouse.moveTo(0, 0);
        mouse.up();

        // create end binding
        mouse.downAt(100, 0);
        mouse.moveTo(100, 1);
        mouse.moveTo(100, 0);
        mouse.up();

        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [{ id: arrowId, type: "arrow" }],
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrowId, type: "arrow" }],
            }),
            expect.objectContaining({
              id: arrowId,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
            }),
          ]),
        );

        Keyboard.undo(); // undo start binding
        Keyboard.undo(); // undo end binding
        expect(API.getUndoStack().length).toBe(2);
        expect(API.getRedoStack().length).toBe(2);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [],
          }),
          expect.objectContaining({ id: rect2.id, boundElements: [] }),
          expect.objectContaining({
            id: arrowId,
            startBinding: null,
            endBinding: null,
          }),
        ]);

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              // no conflicting updates
              x: h.elements[1].x + 50,
            }),
            newElementWith(h.elements[1], {
              // no conflicting updates
              x: h.elements[1].x + 50,
            }),
            newElementWith(h.elements[2], {
              // no conflicting updates
              x: h.elements[1].x + 50,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        runTwice(() => {
          Keyboard.redo();
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(4);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: rect1.id,
                boundElements: expect.arrayContaining([
                  { id: arrowId, type: "arrow" },
                ]),
              }),
              expect.objectContaining({
                id: rect2.id,
                boundElements: [{ id: arrowId, type: "arrow" }],
              }),
              expect.objectContaining({
                id: arrowId,
                startBinding: expect.objectContaining({
                  elementId: rect1.id,
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
                endBinding: expect.objectContaining({
                  elementId: rect2.id,
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
              }),
            ]),
          );

          Keyboard.undo();
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(2);
          expect(API.getRedoStack().length).toBe(2);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [],
            }),
            expect.objectContaining({ id: rect2.id, boundElements: [] }),
            expect.objectContaining({
              id: arrowId,
              startBinding: null,
              endBinding: null,
            }),
          ]);
        });
      });

      it("should rebind bindings when both are updated through the history and the arrow got bound to a different element in the meantime", async () => {
        // create arrow without bindings
        Keyboard.withModifierKeys({ ctrl: true }, () => {
          UI.clickTool("arrow");
          mouse.down(0, 0);
          mouse.up(100, 0);
        });

        const arrowId = h.elements[2].id;

        // create start binding
        mouse.downAt(0, 0);
        mouse.moveTo(0, 1);
        mouse.upAt(0, 0);

        // create end binding
        mouse.downAt(100, 0);
        mouse.moveTo(100, 1);
        mouse.upAt(100, 0);

        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [{ id: arrowId, type: "arrow" }],
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrowId, type: "arrow" }],
            }),
            expect.objectContaining({
              id: arrowId,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
            }),
          ]),
        );

        Keyboard.undo();
        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(2);
        expect(API.getRedoStack().length).toBe(2);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect1.id,
            boundElements: [],
          }),
          expect.objectContaining({ id: rect2.id, boundElements: [] }),
          expect.objectContaining({
            id: arrowId,
            startBinding: null,
            endBinding: null,
          }),
        ]);

        const remoteContainer = API.createElement({
          type: "rectangle",
          width: 50,
          x: 100,
          boundElements: [{ id: arrowId, type: "arrow" }],
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            h.elements[0],
            newElementWith(h.elements[1], { boundElements: [] }),
            newElementWith(h.elements[2] as ExcalidrawElbowArrowElement, {
              endBinding: {
                elementId: remoteContainer.id,
                gap: 1,
                focus: 0,
                fixedPoint: [0.5, 1],
              },
            }),
            remoteContainer,
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        runTwice(() => {
          Keyboard.redo();
          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(4);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: rect1.id,
                boundElements: [{ id: arrowId, type: "arrow" }],
              }),
              expect.objectContaining({
                id: rect2.id,
                boundElements: [{ id: arrowId, type: "arrow" }],
              }),
              expect.objectContaining({
                id: arrowId,
                startBinding: expect.objectContaining({
                  elementId: rect1.id,
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
                // rebound with previous rectangle
                endBinding: expect.objectContaining({
                  elementId: rect2.id,
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
              }),
              expect.objectContaining({
                id: remoteContainer.id,
                boundElements: [],
              }),
            ]),
          );

          Keyboard.undo();
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(2);
          expect(API.getRedoStack().length).toBe(2);
          expect(h.elements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: rect1.id,
                boundElements: [],
              }),
              expect.objectContaining({
                id: rect2.id,
                boundElements: [],
              }),
              expect.objectContaining({
                id: arrowId,
                startBinding: null,
                endBinding: expect.objectContaining({
                  // now we are back in the previous state!
                  elementId: remoteContainer.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
              }),
              expect.objectContaining({
                id: remoteContainer.id,
                // leaving as bound until we can rebind arrows!
                boundElements: [{ id: arrowId, type: "arrow" }],
              }),
            ]),
          );
        });
      });

      it("should rebind remotely added arrow when it's bindable elements are added through the history", async () => {
        const arrow = API.createElement({
          type: "arrow",
          startBinding: {
            elementId: rect1.id,
            gap: 1,
            focus: 0,
            fixedPoint: [1, 0.5],
          },
          endBinding: {
            elementId: rect2.id,
            gap: 1,
            focus: 0,
            fixedPoint: [0.5, 1],
          },
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            arrow,
            newElementWith(h.elements[0], {
              boundElements: [{ id: arrow.id, type: "arrow" }],
            }),
            newElementWith(h.elements[1], {
              boundElements: [{ id: arrow.id, type: "arrow" }],
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        runTwice(() => {
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual([
            expect.objectContaining({
              id: arrow.id,
              startBinding: null,
              endBinding: null,
            }),
            expect.objectContaining({
              id: rect1.id,
              boundElements: [{ id: arrow.id, type: "arrow" }],
              isDeleted: true,
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrow.id, type: "arrow" }],
              isDeleted: true,
            }),
          ]);

          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: arrow.id,
                startBinding: expect.objectContaining({
                  // now we are back in the previous state!
                  elementId: rect1.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
                endBinding: expect.objectContaining({
                  // now we are back in the previous state!
                  elementId: rect2.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
              }),
              expect.objectContaining({
                id: rect1.id,
                boundElements: [{ id: arrow.id, type: "arrow" }],
                isDeleted: false,
              }),
              expect.objectContaining({
                id: rect2.id,
                boundElements: [{ id: arrow.id, type: "arrow" }],
                isDeleted: false,
              }),
            ]),
          );
        });
      });

      it("should rebind remotely added bindable elements when it's arrow is added through the history", async () => {
        Keyboard.undo();
        const arrow = API.createElement({
          type: "arrow",
        });

        // Simulate local update
        API.updateScene({
          elements: [arrow],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate remote update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0] as ExcalidrawElbowArrowElement, {
              startBinding: {
                elementId: rect1.id,
                gap: 1,
                focus: 0,
                fixedPoint: [0.5, 1],
              },
              endBinding: {
                elementId: rect2.id,
                gap: 1,
                focus: 0,
                fixedPoint: [1, 0.5],
              },
            }),
            newElementWith(rect1, {
              boundElements: [{ id: arrow.id, type: "arrow" }],
            }),
            newElementWith(rect2, {
              boundElements: [{ id: arrow.id, type: "arrow" }],
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        runTwice(() => {
          Keyboard.undo();
          expect(API.getUndoStack().length).toBe(0);
          expect(API.getRedoStack().length).toBe(1);
          expect(h.elements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: arrow.id,
                startBinding: expect.objectContaining({
                  elementId: rect1.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
                endBinding: expect.objectContaining({
                  elementId: rect2.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
                isDeleted: true,
              }),
              expect.objectContaining({
                id: rect1.id,
                boundElements: [],
                isDeleted: false,
              }),
              expect.objectContaining({
                id: rect2.id,
                boundElements: [],
                isDeleted: false,
              }),
            ]),
          );

          Keyboard.redo();
          expect(API.getUndoStack().length).toBe(1);
          expect(API.getRedoStack().length).toBe(0);
          expect(h.elements).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: arrow.id,
                startBinding: {
                  elementId: rect1.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                },
                endBinding: expect.objectContaining({
                  elementId: rect2.id,
                  fixedPoint: [
                    expect.toBeNonNaNNumber(),
                    expect.toBeNonNaNNumber(),
                  ],
                  focus: expect.toBeNonNaNNumber(),
                  gap: expect.toBeNonNaNNumber(),
                }),
                isDeleted: false,
              }),
              expect.objectContaining({
                id: rect1.id,
                boundElements: [{ id: arrow.id, type: "arrow" }],
                isDeleted: false,
              }),
              expect.objectContaining({
                id: rect2.id,
                boundElements: [{ id: arrow.id, type: "arrow" }],
                isDeleted: false,
              }),
            ]),
          );
        });
      });

      it("should unbind remotely deleted bindable elements from arrow when the arrow is added through the history", async () => {});

      it("should update bound element points when rectangle was remotely moved and arrow is added back through the history", async () => {
        // bind arrow to rect1 and rect2
        UI.clickTool("arrow");
        mouse.down(0, 0);
        mouse.up(100, 0);

        const arrowId = h.elements[2].id;

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [],
            }),
            expect.objectContaining({ id: rect2.id, boundElements: [] }),
            expect.objectContaining({
              id: arrowId,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: 0,
                gap: 1,
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: -0,
                gap: 1,
              }),
              isDeleted: true,
            }),
          ]),
        );

        // Simulate remote update
        API.updateScene({
          elements: [
            h.elements[0],
            newElementWith(h.elements[1], { x: 500, y: -500 }),
            h.elements[2],
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(2);
        expect(API.getRedoStack().length).toBe(0);
        {
          // no need to be strict about points, hence the rounding
          const points = (h.elements[2] as ExcalidrawLinearElement).points[1];
          expect([
            roundToNearestHundred(points[0]),
            roundToNearestHundred(points[1]),
          ]).toEqual([500, -400]);
        }
        expect(h.elements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rect1.id,
              boundElements: [{ id: arrowId, type: "arrow" }],
            }),
            expect.objectContaining({
              id: rect2.id,
              boundElements: [{ id: arrowId, type: "arrow" }],
            }),
            expect.objectContaining({
              id: arrowId,
              startBinding: expect.objectContaining({
                elementId: rect1.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              endBinding: expect.objectContaining({
                elementId: rect2.id,
                focus: expect.toBeNonNaNNumber(),
                gap: expect.toBeNonNaNNumber(),
              }),
              isDeleted: false,
            }),
          ]),
        );
      });
    });

    describe("conflicts in frames and their children", () => {
      let frame: ExcalidrawFrameElement;
      let rect: ExcalidrawGenericElement;

      const frameProps = {
        type: "frame",
        x: 0,
        width: 500,
      } as const;

      const rectProps = {
        type: "rectangle",
        width: 100,
        x: 10,
        y: 10,
        angle: 0,
      } as const;

      beforeEach(() => {
        frame = API.createElement({ ...frameProps });
        rect = API.createElement({ ...rectProps });
      });

      it("should not rebind frame child with frame when frame was remotely deleted and frame child is added back through the history ", async () => {
        // Initialize the scene
        API.updateScene({
          elements: [frame],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Simulate local update
        API.updateScene({
          elements: [rect, h.elements[0]],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Simulate local update
        API.updateScene({
          elements: [
            newElementWith(h.elements[0], {
              frameId: frame.id,
            }),
            h.elements[1],
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        Keyboard.undo();
        expect(API.getUndoStack().length).toBe(1);
        expect(API.getRedoStack().length).toBe(1);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect.id,
            frameId: null,
            isDeleted: false,
          }),
          expect.objectContaining({
            id: frame.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(2);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect.id,
            frameId: frame.id, // double check that the element is rebound
            isDeleted: false,
          }),
          expect.objectContaining({
            id: frame.id,
            isDeleted: false,
          }),
        ]);

        Keyboard.undo();
        Keyboard.undo();

        // Simulate remote update
        API.updateScene({
          elements: [
            h.elements[0],
            newElementWith(h.elements[1], {
              isDeleted: true,
            }),
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        Keyboard.redo();
        Keyboard.redo();
        expect(API.getUndoStack().length).toBe(2);
        expect(API.getRedoStack().length).toBe(0);
        expect(h.elements).toEqual([
          expect.objectContaining({
            id: rect.id,
            frameId: null, // element is not unbound from
            isDeleted: false,
          }),
          expect.objectContaining({
            id: frame.id,
            isDeleted: true,
          }),
        ]);
      });
    });
  });
});
