import React from "react";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
  KEYS,
} from "@excalidraw/common";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, render, waitFor } from "./test-utils";

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
      expect(h.app.state.searchMatches?.matches.length).toBe(2);
      expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
    });

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(false);
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(true);

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(false);
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
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
      expect(h.app.state.searchMatches?.matches[0]?.matchedLines?.length).toBe(
        4,
      );
    });

    updateTextEditor(searchInput, "ext spli");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
      expect(h.app.state.searchMatches?.matches[0]?.matchedLines?.length).toBe(
        6,
      );
    });
  });

  it("should keep search results order stable when an element is moved (#9503)", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const elementA = API.createElement({
      type: "text",
      text: "test alpha",
      y: 100,
    });
    const elementB = API.createElement({
      type: "text",
      text: "test bravo",
      y: 500,
    });
    API.setElements([elementA, elementB]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput = await querySearchInput();
    updateTextEditor(searchInput, "test");

    // first render: top-to-bottom by y -> A then B
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(2);
      expect(h.app.state.searchMatches?.matches[0].id).toBe(elementA.id);
      expect(h.app.state.searchMatches?.matches[1].id).toBe(elementB.id);
    });

    const initialMatches = h.app.state.searchMatches!.matches;

    // move A to below B and commit via a full scene update (mimics drag-end
    // `replaceAllElements`, which is what triggers SearchMenu's re-search).
    // A y-based re-sort would now put B first.
    const movedA = {
      ...(h.elements[0] as ExcalidrawTextElement),
      y: 1000,
    };
    API.setElements([movedA, h.elements[1]]);

    // wait for search to re-run (new matches array reference)
    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches).not.toBe(initialMatches);
    });

    // order must stay stable: A still first even though it has higher y now
    expect(h.app.state.searchMatches?.matches[0].id).toBe(elementA.id);
    expect(h.app.state.searchMatches?.matches[1].id).toBe(elementB.id);
  });

  it("should append newly matching elements at the end of the search results (#9503)", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const elementA = API.createElement({
      type: "text",
      text: "test alpha",
      y: 100,
    });
    const elementB = API.createElement({
      type: "text",
      text: "test bravo",
      y: 500,
    });
    API.setElements([elementA, elementB]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput = await querySearchInput();
    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(2);
    });

    const initialMatches = h.app.state.searchMatches!.matches;

    // add a new matching element with `y` between A and B; a y-based sort
    // would slot it between them, but we want stable order with the new
    // match appended at the end.
    const elementC = API.createElement({
      type: "text",
      text: "test charlie",
      y: 300,
    });
    API.setElements([...h.elements, elementC]);

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(3);
      expect(h.app.state.searchMatches?.matches).not.toBe(initialMatches);
    });

    expect(h.app.state.searchMatches?.matches[0].id).toBe(elementA.id);
    expect(h.app.state.searchMatches?.matches[1].id).toBe(elementB.id);
    expect(h.app.state.searchMatches?.matches[2].id).toBe(elementC.id);
  });

  it("should match frame names", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({
        type: "frame",
      }),
    ]);

    API.updateElement(h.elements[0] as ExcalidrawFrameLikeElement, {
      name: "Frame: name test for frame, yes, frame!",
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

    updateTextEditor(searchInput, "frame");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(3);
    });
  });
});
