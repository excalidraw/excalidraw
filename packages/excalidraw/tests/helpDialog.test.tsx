import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { t } from "../i18n";

import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

const openHelpDialog = async () => {
  await render(<Excalidraw handleKeyboardGlobally />);

  act(() => {
    h.app.setState({ openDialog: { name: "help" } });
  });

  await waitFor(() => {
    expect(h.app.state.openDialog?.name).toBe("help");
  });

  const searchInput = document.querySelector<HTMLInputElement>(
    'input[aria-label="Search keyboard shortcuts"]',
  );

  await waitFor(() => {
    expect(searchInput).not.toBeNull();
  });

  return searchInput!;
};

describe("help dialog", () => {
  it("filters shortcut labels case-insensitively", async () => {
    const searchInput = await openHelpDialog();
    const selectionLabel = t("toolBar.selection");
    const rectangleLabel = t("toolBar.rectangle");

    fireEvent.change(searchInput, { target: { value: "SELEC" } });

    await waitFor(() => {
      expect(document.body.textContent).toContain(selectionLabel);
      expect(document.body.textContent).not.toContain(rectangleLabel);
    });

    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(document.body.textContent).toContain(rectangleLabel);
    });
  });

  it("focuses the search field on ctrl/cmd+f without opening global search", async () => {
    const searchInput = await openHelpDialog();

    expect(h.app.state.openSidebar).toBeNull();

    act(() => {
      fireEvent.keyDown(document, {
        key: KEYS.F,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
      expect(h.app.state.openSidebar).toBeNull();
    });

    searchInput.blur();

    act(() => {
      fireEvent.keyDown(document, {
        key: KEYS.F,
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
      expect(h.app.state.openSidebar).toBeNull();
    });
  });

  it("does not open the global search sidebar when help dialog is open", async () => {
    const searchInput = await openHelpDialog();

    act(() => {
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.F, document);
      });
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
      expect(h.app.state.openSidebar).toBeNull();
    });
  });
});
