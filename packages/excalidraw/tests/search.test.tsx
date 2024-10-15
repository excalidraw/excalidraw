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

  describe("LTR and RTL", () => {
    describe("LTR", () => {
      it("should work with LTR text", async () => {
        const scrollIntoViewMock = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        API.setElements([
          API.createElement({
            type: "text",
            text: "aaa bbb ccc",
            width: 159.31779010087632,
          }),
        ]);

        expect(h.app.state.openSidebar).toBeNull();

        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.F);
        });

        expect(h.app.state.openSidebar).not.toBeNull();
        expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
        expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

        const searchInput =
          h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
            `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
          );

        expect(searchInput?.matches(":focus")).toBe(true);

        updateTextEditor(searchInput!, "aaa");

        await waitFor(() => {
          expect(h.app.state.searchMatches.length).toBe(1);
          expect(h.app.state.searchMatches[0].focus).toBe(true);
          console.log("here firstly", h.app.state.searchMatches[0]);
          expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(0);
        });
      });

      it("should work with LTR text and center alignment", async () => {
        const scrollIntoViewMock = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        API.setElements([
          API.createElement({
            type: "text",
            text: "aaa bbb ccc",
            width: 159.31779010087632,
            textAlign: "center",
          }),
        ]);

        expect(h.app.state.openSidebar).toBeNull();

        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.F);
        });

        expect(h.app.state.openSidebar).not.toBeNull();
        expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
        expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

        const searchInput =
          h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
            `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
          );

        expect(searchInput?.matches(":focus")).toBe(true);

        updateTextEditor(searchInput!, "bbb");

        await waitFor(() => {
          expect(h.app.state.searchMatches.length).toBe(1);
          expect(h.app.state.searchMatches[0].focus).toBe(true);
          expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(
            64.65889505043816,
          );
        });
      });

      it("should work with LTR text and right alignment", async () => {
        const scrollIntoViewMock = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        API.setElements([
          API.createElement({
            type: "text",
            text: "aaa bbb ccc",
            width: 159.31779010087632,
            textAlign: "right",
          }),
        ]);

        expect(h.app.state.openSidebar).toBeNull();

        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.F);
        });

        expect(h.app.state.openSidebar).not.toBeNull();
        expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
        expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

        const searchInput =
          h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
            `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
          );

        expect(searchInput?.matches(":focus")).toBe(true);

        updateTextEditor(searchInput!, "ccc");

        await waitFor(() => {
          expect(h.app.state.searchMatches.length).toBe(1);
          expect(h.app.state.searchMatches[0].focus).toBe(true);
          expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(
            129.31779010087632,
          );
        });
      });
    });

    describe("RTL", () => {
      it("should work with RTL text", async () => {
        const scrollIntoViewMock = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        API.setElements([
          API.createElement({
            type: "text",
            text: "אאא בבב גגג דדד",
            width: 152.173828125,
            textAlign: "right",
          }),
        ]);

        expect(h.app.state.openSidebar).toBeNull();

        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.F);
        });

        expect(h.app.state.openSidebar).not.toBeNull();
        expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
        expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

        const searchInput =
          h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
            `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
          );

        expect(searchInput?.matches(":focus")).toBe(true);

        updateTextEditor(searchInput!, "אאא");

        await waitFor(() => {
          expect(h.app.state.searchMatches.length).toBe(1);
          expect(h.app.state.searchMatches[0].focus).toBe(true);
          // Despite the fact that search query matched start of the text in RTL mode, offset should be at the end of the text box
          expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(
            122.173828125,
          );
        });
      });

      it("should work with RTL text and center alignment", async () => {
        const scrollIntoViewMock = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        API.setElements([
          API.createElement({
            type: "text",
            text: "אאא בבב גגג דדד",
            width: 152.173828125,
            textAlign: "center",
          }),
        ]);

        expect(h.app.state.openSidebar).toBeNull();

        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.F);
        });

        expect(h.app.state.openSidebar).not.toBeNull();
        expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
        expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

        const searchInput =
          h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
            `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
          );

        expect(searchInput?.matches(":focus")).toBe(true);

        updateTextEditor(searchInput!, "גגג");

        await waitFor(() => {
          expect(h.app.state.searchMatches.length).toBe(1);
          expect(h.app.state.searchMatches[0].focus).toBe(true);
          expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(
            41.0869140625,
          );
        });
      });

      it("should work with RTL text and left alignment", async () => {
        const scrollIntoViewMock = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        API.setElements([
          API.createElement({
            type: "text",
            text: "אאא בבב גגג דדד",
            width: 152.173828125,
            textAlign: "left",
          }),
        ]);

        expect(h.app.state.openSidebar).toBeNull();

        Keyboard.withModifierKeys({ ctrl: true }, () => {
          Keyboard.keyPress(KEYS.F);
        });

        expect(h.app.state.openSidebar).not.toBeNull();
        expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
        expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

        const searchInput =
          h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
            `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
          );

        expect(searchInput?.matches(":focus")).toBe(true);

        updateTextEditor(searchInput!, "דדד");

        await waitFor(() => {
          expect(h.app.state.searchMatches.length).toBe(1);
          expect(h.app.state.searchMatches[0].focus).toBe(true);
          expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(0);
        });
      });
    });

    it("should work with mixed LTR and RTL text", async () => {
      const scrollIntoViewMock = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      API.setElements([
        API.createElement({
          type: "text",
          text: "אאא בבב גגג דדד",
          width: 152.173828125,
          textAlign: "right",
        }),
        API.createElement({
          type: "text",
          text: "aaa bbb ccc ddd",
          textAlign: "left",
          width: 159.31779010087632,
        }),
        API.createElement({
          type: "text",
          text: "aaa בבב bbb גגג ddd",
          textAlign: "left",
          width: 195.67397093772888,
        }),
      ]);

      expect(h.app.state.openSidebar).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.F);
      });

      expect(h.app.state.openSidebar).not.toBeNull();
      expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
      expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

      const searchInput =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );

      expect(searchInput?.matches(":focus")).toBe(true);

      updateTextEditor(searchInput!, "בבב");

      await waitFor(() => {
        // Finds "אאא בבב גגג דדד"
        expect(h.app.state.searchMatches.length).toBe(2);
        expect(h.app.state.searchMatches[0].focus).toBe(true);
        expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(
          82.173828125,
        );
      });

      Keyboard.keyPress(KEYS.ENTER, searchInput!);

      await waitFor(() => {
        // Finds "aaa בבב bbb גגג ddd"
        expect(h.app.state.searchMatches.length).toBe(2);
        expect(h.app.state.searchMatches[1].focus).toBe(true);
        expect(h.app.state.searchMatches[1].matchedLines[0].offsetX).toBe(40);
      });

      updateTextEditor(searchInput!, "bbb");

      await waitFor(() => {
        // Finds "aaa bbb ccc ddd"
        expect(h.app.state.searchMatches.length).toBe(2);
        expect(h.app.state.searchMatches[0].focus).toBe(true);
        expect(h.app.state.searchMatches[0].matchedLines[0].offsetX).toBe(40);
      });

      Keyboard.keyPress(KEYS.ENTER, searchInput!);

      await waitFor(() => {
        // Finds "aaa בבב bbb גגג ddd"
        expect(h.app.state.searchMatches.length).toBe(2);
        expect(h.app.state.searchMatches[1].focus).toBe(true);
        expect(h.app.state.searchMatches[1].matchedLines[0].offsetX).toBe(80);
      });
    });
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
