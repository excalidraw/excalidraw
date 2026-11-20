import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, render, waitFor } from "./test-utils";

const { h } = window;

const openHelpDialog = async () => {
  act(() => {
    h.setState({ openDialog: { name: "help" } });
  });
  return await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>(
      ".HelpDialog__search input",
    );
    expect(input).not.toBeNull();
    return input!;
  });
};

const queryShortcutLabels = () =>
  [...document.querySelectorAll(".HelpDialog__shortcut > div:first-child")].map(
    (label) => label.textContent,
  );

describe("help dialog", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("should focus the shortcut search on ctrl+f instead of opening canvas search", async () => {
    const searchInput = await openHelpDialog();
    expect(searchInput.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    expect(searchInput.matches(":focus")).toBe(true);
    expect(h.state.openDialog).toEqual({ name: "help" });
    expect(h.state.openSidebar).toBeNull();
  });

  it("should filter shortcuts by label and by key", async () => {
    const searchInput = await openHelpDialog();
    const allLabels = queryShortcutLabels();
    expect(allLabels.length).toBeGreaterThan(20);
    expect(document.querySelector(".HelpDialog__no-results")).toBeNull();

    updateTextEditor(searchInput, "rectangle");
    await waitFor(() => {
      const labels = queryShortcutLabels();
      expect(labels).toContain("Rectangle");
      expect(labels).not.toContain("Hand (panning tool)");
      expect(labels.length).toBeLessThan(allLabels.length);
    });

    updateTextEditor(searchInput, "shift + f");
    await waitFor(() => {
      expect(queryShortcutLabels()).toContain("Show font picker");
    });

    updateTextEditor(searchInput, "zzzzzz");
    await waitFor(() => {
      expect(queryShortcutLabels()).toEqual([]);
      expect(document.querySelector(".HelpDialog__no-results")).not.toBeNull();
    });

    updateTextEditor(searchInput, "");
    await waitFor(() => {
      expect(queryShortcutLabels()).toEqual(allLabels);
    });
  });

  it("should clear the search on Escape before closing the dialog", async () => {
    const searchInput = await openHelpDialog();

    updateTextEditor(searchInput, "rectangle");
    await waitFor(() => {
      expect(queryShortcutLabels()).toContain("Rectangle");
    });

    Keyboard.keyDown(KEYS.ESCAPE, searchInput);
    await waitFor(() => {
      expect(searchInput.value).toBe("");
    });
    expect(h.state.openDialog).toEqual({ name: "help" });

    Keyboard.keyDown(KEYS.ESCAPE, searchInput);
    await waitFor(() => {
      expect(h.state.openDialog).toBeNull();
    });
  });
});
