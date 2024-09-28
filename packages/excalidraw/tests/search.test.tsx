import React from "react";
import { act, render, waitFor } from "./test-utils";
import { Excalidraw } from "../index";
import { CANVAS_SEARCH_TAB, CLASSES, DEFAULT_SIDEBAR } from "../constants";
import { Keyboard } from "./helpers/ui";
import { KEYS } from "../keys";
import { updateTextEditor } from "./queries/dom";
import { API } from "./helpers/api";
import type { ExcalidrawTextElement } from "../element/types";

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
    API.setAppState({
      openSidebar: null,
    });
  });

  it("should toggle search on cmd+f", async () => {
    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

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

    act(() => {
      searchInput?.blur();
    });

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
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

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

  it("should match text split across multiple lines", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({
        type: "text",
        text: "",
      }),
    ]);

    API.updateElement(h.elements[0] as ExcalidrawTextElement, {
      text: "t\ne\ns\nt \nt\ne\nx\nt \ns\np\nli\nt \ni\nn\nt\no\nm\nu\nlt\ni\np\nl\ne \nli\nn\ne\ns",
      originalText: "test text split into multiple lines",
    });

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches.length).toBe(1);
      expect(h.app.state.searchMatches[0]?.matchedLines?.length).toBe(4);
    });

    updateTextEditor(searchInput, "ext spli");

    await waitFor(() => {
      expect(h.app.state.searchMatches.length).toBe(1);
      expect(h.app.state.searchMatches[0]?.matchedLines?.length).toBe(6);
    });
  });
});
