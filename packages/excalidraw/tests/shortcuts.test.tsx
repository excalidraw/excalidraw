import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

describe("shortcuts", () => {
  it("Clear canvas shortcut should display confirm dialog", async () => {
    await render(
      <Excalidraw
        initialData={{ elements: [API.createElement({ type: "rectangle" })] }}
        handleKeyboardGlobally
      />,
    );

    expect(window.h.elements.length).toBe(1);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyDown(KEYS.DELETE);
    });
    const confirmDialog = document.querySelector(".confirm-dialog")!;
    expect(confirmDialog).not.toBe(null);

    fireEvent.click(confirmDialog.querySelector('[aria-label="Confirm"]')!);

    await waitFor(() => {
      expect(window.h.elements[0].isDeleted).toBe(true);
    });
  });

  // Regression test for https://github.com/excalidraw/excalidraw/issues/9281
  it("Ctrl+S in text editor should prevent default browser save dialog", async () => {
    const preventDefaultMock = jest.fn();
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "text" })],
        }}
        handleKeyboardGlobally
      />,
    );

    // Focus on the text element to enter text editing mode
    const textElement = document.querySelector(".excalidraw-textEditable");
    expect(textElement).not.toBe(null);

    // Simulate Ctrl+S keydown event while in text editing mode
    const keyboardEvent = new KeyboardEvent("keydown", {
      key: "s",
      code: "KeyS",
      ctrlKey: true,
      metaKey: false,
      bubbles: true,
    });
    keyboardEvent.preventDefault = preventDefaultMock;

    // Dispatch the event
    document.dispatchEvent(keyboardEvent);

    // The event should be prevented (browser default save dialog should not appear)
    expect(preventDefaultMock).toHaveBeenCalled();
  });
});
