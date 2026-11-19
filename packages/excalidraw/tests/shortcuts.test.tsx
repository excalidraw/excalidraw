import React from "react";

import { CLASSES, KEYS } from "@excalidraw/common";

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

  // regression test for #9281: Ctrl/Cmd+S while focus is inside an input
  // (here the canvas search field) used to fall through to the browser's
  // "save page as" dialog instead of saving the scene
  it("Ctrl/Cmd+S should save the scene while an input is focused", async () => {
    await render(<Excalidraw handleKeyboardGlobally />);

    // open the canvas search sidebar, which focuses a text input
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput =
      window.h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      )!;
    await waitFor(() => expect(searchInput).not.toBeNull());
    expect(searchInput.matches(":focus")).toBe(true);

    const handleKeyDown = jest
      .spyOn(window.h.app.actionManager, "handleKeyDown")
      .mockReturnValue(true);

    // dispatching returns false when a handler called preventDefault, i.e.
    // the browser's native save-page dialog was suppressed
    const notCancelled = fireEvent.keyDown(searchInput, {
      key: KEYS.S,
      ctrlKey: true,
    });

    expect(notCancelled).toBe(false);
    expect(handleKeyDown).toHaveBeenCalled();

    handleKeyDown.mockRestore();
  });
});
