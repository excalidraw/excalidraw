import React from "react";
import { render, waitFor } from "./test-utils";
import { Excalidraw } from "../index";
import { CLASSES, SEARCH_SIDEBAR } from "../constants";
import { Keyboard } from "./helpers/ui";
import { KEYS } from "../keys";
import { updateTextEditor } from "./queries/dom";
import { API } from "./helpers/api";

const { h } = window;

const querySearchInput = async () => {
  const input =
    h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
      `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
    )!;
  await waitFor(() => expect(input).not.toBeNull());
  return input;
};

describe("search", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    h.setState({
      openSidebar: null,
    });
  });

  it("should toggle search on cmd+f", async () => {
    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(SEARCH_SIDEBAR.name);

    const searchInput = await querySearchInput();
    expect(searchInput.matches(":focus")).toBe(true);
  });

  it("should refocus search input with cmd+f when search sidebar is still open", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      );

    searchInput?.blur();

    expect(h.app.state.openSidebar).not.toBeNull();
    expect(searchInput?.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(searchInput?.matches(":focus")).toBe(true);
  });

  it("should match text and cycle through matches on Enter", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({ type: "text", text: "test one" }),
      API.createElement({ type: "text", text: "test two" }),
    ]);

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(SEARCH_SIDEBAR.name);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches.length).toBe(2);
      expect(h.app.state.searchMatches[0].focus).toBe(true);
    });

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches[0].focus).toBe(false);
    expect(h.app.state.searchMatches[1].focus).toBe(true);

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches[0].focus).toBe(true);
    expect(h.app.state.searchMatches[1].focus).toBe(false);
  });
});
