import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

const getShortcutLabels = () =>
  Array.from(
    document.querySelectorAll(
      ".HelpDialog .HelpDialog__shortcut > div:first-child",
    ),
  ).map((element) => element.textContent ?? "");

const openHelpDialog = async () => {
  API.setAppState({ openSidebar: null, openDialog: { name: "help" } });

  const input = await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>(
      ".HelpDialog .HelpDialog__search input",
    );
    expect(input).not.toBeNull();
    return input!;
  });

  // let the dialog's own autofocus settle so it can't race the assertions
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return input;
};

describe("help dialog", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("should focus the shortcut search on cmd+f instead of leaving the key dead", async () => {
    const input = await openHelpDialog();
    expect(input.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    expect(input.matches(":focus")).toBe(true);
  });

  it("should keep the dialog open and not open canvas search on cmd+f", async () => {
    await openHelpDialog();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    expect(h.app.state.openDialog?.name).toBe("help");
    expect(h.app.state.openSidebar).toBeNull();
  });

  it("should filter shortcuts by label", async () => {
    const input = await openHelpDialog();
    expect(getShortcutLabels().length).toBeGreaterThan(1);

    fireEvent.change(input, { target: { value: "zoom" } });

    await waitFor(() => {
      const labels = getShortcutLabels();
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.every((label) => /zoom/i.test(label))).toBe(true);
    });
  });

  it("should show an empty state when no shortcut matches", async () => {
    const input = await openHelpDialog();

    fireEvent.change(input, { target: { value: "no-such-shortcut" } });

    await waitFor(() => {
      expect(getShortcutLabels()).toHaveLength(0);
      expect(document.querySelector(".HelpDialog__no-results")).not.toBeNull();
    });
  });

  it("should restore all shortcuts when the query is cleared", async () => {
    const input = await openHelpDialog();
    const initialCount = getShortcutLabels().length;

    fireEvent.change(input, { target: { value: "zoom" } });
    await waitFor(() =>
      expect(getShortcutLabels().length).toBeLessThan(initialCount),
    );

    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(getShortcutLabels()).toHaveLength(initialCount));
  });
});
