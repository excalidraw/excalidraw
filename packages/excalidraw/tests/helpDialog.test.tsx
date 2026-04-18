import React from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "../i18n";
import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, screen, waitFor } from "./test-utils";

describe("help dialog", () => {
  const renderHelpDialog = async () => {
    await render(<Excalidraw handleKeyboardGlobally />);

    act(() => {
      window.h.setState({ openDialog: { name: "help" } });
    });

    await waitFor(() => {
      expect(screen.getByText(t("helpDialog.title"))).toBeInTheDocument();
    });

    const searchInput = document.querySelector<HTMLInputElement>(
      '.HelpDialog input[type="search"]',
    );

    expect(searchInput).not.toBe(null);

    return searchInput!;
  };

  it("should focus help search when cmd+f is pressed", async () => {
    const searchInput = await renderHelpDialog();

    expect(searchInput.matches(":focus")).toBe(false);
    expect(window.h.state.openSidebar).toBe(null);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyDown(KEYS.F, window);
    });

    await waitFor(() => {
      expect(searchInput.matches(":focus")).toBe(true);
    });
    expect(window.h.state.openSidebar).toBe(null);
  });

  it("should filter shortcuts using the help search input", async () => {
    const searchInput = await renderHelpDialog();

    fireEvent.change(searchInput, {
      target: { value: t("labels.toggleTheme") },
    });

    await waitFor(() => {
      expect(screen.getByText(t("labels.toggleTheme"))).toBeInTheDocument();
    });

    expect(screen.queryByText(t("toolBar.rectangle"))).toBe(null);
  });
});
