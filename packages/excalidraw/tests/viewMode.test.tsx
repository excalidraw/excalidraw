import React from "react";

import { CURSOR_TYPE, KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import {
  fireEvent,
  render,
  GlobalTestState,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const queryContainer = (selector: string) =>
  GlobalTestState.renderResult.container.querySelector(selector);

const mouse = new Pointer("mouse");
const touch = new Pointer("touch");
const pen = new Pointer("pen");
const pointerTypes = [mouse, touch, pen];

describe("view mode", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("after switching to view mode – cursor type should be pointer", async () => {
    API.setAppState({ viewModeEnabled: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.GRAB,
    );
  });

  it("after switching to view mode, moving, clicking, and pressing space key – cursor type should be pointer", async () => {
    API.setAppState({ viewModeEnabled: true });

    pointerTypes.forEach((pointerType) => {
      const pointer = pointerType;
      pointer.reset();
      pointer.move(100, 100);
      pointer.click();
      Keyboard.keyPress(KEYS.SPACE);
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.GRAB,
      );
    });
  });

  it("cursor should stay as grabbing type when hovering over canvas elements", async () => {
    // create a rectangle, then hover over it – cursor should be
    // move type for mouse and grab for touch & pen
    // then switch to view-mode and cursor should be grabbing type
    UI.createElement("rectangle", { size: 100 });

    pointerTypes.forEach((pointerType) => {
      const pointer = pointerType;

      pointer.moveTo(50, 50);
      // eslint-disable-next-line dot-notation
      if (pointerType["pointerType"] === "mouse") {
        expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
          CURSOR_TYPE.MOVE,
        );
      } else {
        expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
          CURSOR_TYPE.GRAB,
        );
      }

      API.setAppState({ viewModeEnabled: true });
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.GRAB,
      );
    });
  });

  it("submits active text editing when entering view mode", async () => {
    const text = API.createElement({
      type: "text",
      text: "before",
      x: 20,
      y: 20,
    });
    API.setElements([text]);
    API.setSelectedElements([text]);
    Keyboard.keyPress(KEYS.ENTER);

    const editor = await getTextEditor();
    updateTextEditor(editor, "committed before view mode");

    GlobalTestState.renderResult.rerender(
      <Excalidraw viewModeEnabled={true} handleKeyboardGlobally={true} />,
    );

    await waitFor(() => {
      expect(h.state.editingTextElement).toBe(null);
      expect(queryContainer(".excalidraw-wysiwyg")).toBe(null);
    });
    expect(h.elements.find((element) => element.id === text.id)).toMatchObject({
      originalText: "committed before view mode",
    });
  });

  it("commits frame-name editing when entering view mode", async () => {
    const frame = API.createElement({
      type: "frame",
      x: 20,
      y: 30,
      width: 80,
      height: 50,
    });
    API.setElements([frame]);
    API.updateElement(frame, { name: "before" });
    API.setAppState({ editingFrame: frame.id });

    const frameNameInput = await waitFor(() => {
      const input = queryContainer(".frame-name input");
      expect(input).not.toBe(null);
      return input as HTMLInputElement;
    });
    fireEvent.change(frameNameInput, { target: { value: "  committed  " } });

    API.setAppState({ viewModeEnabled: true });

    await waitFor(() => {
      expect(h.state.editingFrame).toBe(null);
      expect(queryContainer(".frame-name input")).toBe(null);
    });
    expect(h.elements.find((element) => element.id === frame.id)).toMatchObject(
      { name: "committed" },
    );
  });
});
