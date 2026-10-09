import React from "react";
import { isWritableElement, KEYS } from "@excalidraw/common";

import { createTestHook } from "../components/App";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import {
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

createTestHook();
const { h } = window;

// Enters text-editing mode on a text element and returns the writable WYSIWYG
// <textarea> editor (whose `event.target` is writable).
const setupTextEditor = async (): Promise<HTMLTextAreaElement> => {
  mockBoundingClientRect();
  await render(<Excalidraw autoFocus={true} />);
  const text = API.createElement({ type: "text", text: "hello", x: 20, y: 20 });
  API.setElements([text]);
  API.setSelectedElements([text]);
  Keyboard.keyPress("Enter", GlobalTestState.interactiveCanvas);
  const editor = await getTextEditor();
  expect(editor).not.toBeNull();
  expect(isWritableElement(editor)).toBe(true);
  return editor;
};

describe("save shortcut while editing text (#9281)", () => {
  beforeEach(() => {
    unmountComponent();
  });
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("plain Ctrl/Cmd+S while editing text saves + preventDefaults (no browser Save Page)", async () => {
    const editor = await setupTextEditor();
    // fireEvent returns `false` when a handler called preventDefault().
    expect(fireEvent.keyDown(editor, { key: "s", ctrlKey: true })).toBe(false);
  });

  it("Ctrl/Cmd+S with CapsLock ON (event.key 'S') must also save + preventDefault (#9281)", async () => {
    const editor = await setupTextEditor();
    // Before the fix, actionSaveToActiveFile.keyTest was case-sensitive
    // (event.key === KEYS.S), so CapsLock ("S" !== "s") made the editor skip the
    // save branch → preventDefault not called → browser "Save Page As" default.
    expect(fireEvent.keyDown(editor, { key: "S", ctrlKey: true })).toBe(false);
  });

  it("Ctrl/Cmd+Shift+S (save-as) is NOT hijacked by the save-to-active-file path (unchanged by the fix)", async () => {
    const editor = await setupTextEditor();
    // saveToActiveFile.keyTest requires !shiftKey, so Ctrl+Shift+S is a separate
    // (save-as) path the fix must not intercept.
    expect(
      fireEvent.keyDown(editor, { key: "S", ctrlKey: true, shiftKey: true }),
    ).toBe(true);
  });

  it("unrelated Ctrl/Cmd+key inside text editing keeps existing behavior (no preventDefault)", async () => {
    const editor = await setupTextEditor();
    expect(fireEvent.keyDown(editor, { key: "b", ctrlKey: true })).toBe(true);
  });

  it("Escape inside text editing still finalizes the editor", async () => {
    const editor = await setupTextEditor();
    fireEvent.keyDown(editor, { key: KEYS.ESCAPE });
    await waitFor(() => expect(h.state.editingTextElement).toBe(null));
  });
});
