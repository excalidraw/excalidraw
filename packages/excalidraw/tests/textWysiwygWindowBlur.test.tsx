import React from "react";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

// In its own file: the `blur` listeners which the editors left open by
// earlier tests still hold on the shared window would fire here too.

const { h } = window;

unmountComponent();

const mouse = new Pointer("mouse");

const nextTick = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("text editor on window blur", () => {
  beforeAll(() => {
    mockBoundingClientRect({ height: 400, width: 800 });
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should keep editing when the window loses focus, also after a pan", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    const textElement = UI.createElement("text");
    mouse.clickOn(textElement);
    const textarea = await getTextEditor();
    // the editor arms its submit-on-blur a tick after it's created
    await nextTick();
    updateTextEditor(textarea, "Hello");
    expect(document.activeElement).toBe(textarea);

    // switching apps/tabs blurs the textarea, then the window, without
    // moving the document's focus: the browser gives it back on return
    fireEvent.blur(textarea);
    fireEvent.blur(window);
    expect(h.state.editingTextElement?.id).toBe(textElement.id);
    expect(await getTextEditor({ waitForEditor: false })).toBe(textarea);

    // a wheel-button pan disables submit-on-blur while it lasts and
    // listens for a window blur instead; that one must not end the edit
    // once the textarea is focused again either
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const pointer = {
      pointerId: 1,
      pointerType: "mouse",
      button: 1,
      buttons: 4,
      clientX: 100,
      clientY: 100,
    };
    fireEvent.pointerDown(textarea, pointer);
    fireEvent.pointerUp(window, { ...pointer, buttons: 0 });
    await nextTick();
    expect(document.activeElement).toBe(textarea);

    fireEvent.blur(textarea);
    fireEvent.blur(window);
    expect(h.state.editingTextElement?.id).toBe(textElement.id);
    expect(await getTextEditor({ waitForEditor: false })).toBe(textarea);

    // focus actually leaving the textarea still submits
    textarea.blur();
    expect(h.state.editingTextElement).toBeNull();
    expect(await getTextEditor({ waitForEditor: false })).toBe(null);
    expect((h.elements[0] as ExcalidrawTextElement).text).toBe("Hello");
  });
});
