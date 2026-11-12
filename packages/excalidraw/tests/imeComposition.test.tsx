import { render as renderComponent } from "@testing-library/react";
import React from "react";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
  KEYS,
  LIBRARY_SIDEBAR_TAB,
} from "@excalidraw/common";

import { ChatInterface } from "../components/TTDDialog/Chat/ChatInterface";
import { CommandPalette, Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

(global as any).ResizeObserver =
  (global as any).ResizeObserver ||
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

window.HTMLElement.prototype.scrollIntoView = jest.fn();

/**
 * What the browser sends for a key the IME consumes: `isComposing` as a rule,
 * and only `keyCode` 229 in Safari, whose composition ends before the keydown.
 */
const COMPOSING_EVENTS = [{ isComposing: true }, { keyCode: 229 }];

const composingKeyDown = (target: Element, key: string) => {
  for (const composing of COMPOSING_EVENTS) {
    fireEvent.keyDown(target, { key, ...composing });
  }
};

const flushTimers = () =>
  act(() => new Promise((resolve) => setTimeout(resolve)));

describe("keys of an IME composition", () => {
  describe("chat of text to diagram", () => {
    it("should not send the prompt on the Enter confirming a conversion", () => {
      const onGenerate = vi.fn();
      const { container } = renderComponent(
        <ChatInterface
          chatId="chat"
          messages={[]}
          currentPrompt="にほんご"
          onPromptChange={() => {}}
          onGenerate={onGenerate}
          isGenerating={false}
        />,
      );
      const textarea = container.querySelector("textarea")!;

      composingKeyDown(textarea, KEYS.ENTER);
      expect(onGenerate).not.toHaveBeenCalled();

      fireEvent.keyDown(textarea, { key: KEYS.ENTER });
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe("search", () => {
    it("should neither move between the matches nor close the sidebar", async () => {
      await render(<Excalidraw handleKeyboardGlobally />);
      API.setElements([
        API.createElement({ type: "text", text: "日本語 一" }),
        API.createElement({ type: "text", text: "日本語 二" }),
      ]);
      API.setAppState({
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: CANVAS_SEARCH_TAB },
      });

      const input = await waitFor(() => {
        const element = h.app.excalidrawContainerValue.container?.querySelector(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );
        expect(element).not.toBeNull();
        return element as HTMLInputElement;
      });
      updateTextEditor(input, "日本語");
      await waitFor(() => {
        expect(h.app.state.searchMatches?.matches.length).toBe(2);
        expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
      });

      composingKeyDown(input, KEYS.ENTER);
      composingKeyDown(input, KEYS.ARROW_DOWN);
      composingKeyDown(input, KEYS.ESCAPE);
      expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
      expect(h.app.state.openSidebar).not.toBeNull();

      fireEvent.keyDown(input, { key: KEYS.ENTER });
      expect(h.app.state.searchMatches?.matches[1].focus).toBe(true);
    });
  });

  describe("command palette", () => {
    it("should neither run the selected command nor close", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally>
          <CommandPalette />
        </Excalidraw>,
      );
      API.setAppState({ openDialog: { name: "commandPalette" } });

      const dialog = await waitFor(() => {
        const element = document.querySelector(".command-palette-dialog");
        expect(element).not.toBeNull();
        return element!;
      });
      const input = dialog.querySelector("input")!;
      const selected = () =>
        dialog.querySelector(".item-selected")?.textContent;
      await waitFor(() => expect(selected()).toBeTruthy());
      const initiallySelected = selected();

      composingKeyDown(input, KEYS.ARROW_DOWN);
      expect(selected()).toBe(initiallySelected);

      composingKeyDown(input, KEYS.ENTER);
      composingKeyDown(input, KEYS.ESCAPE);
      await flushTimers();
      expect(h.state.openDialog?.name).toBe("commandPalette");

      fireEvent.keyDown(input, { key: KEYS.ESCAPE });
      expect(h.state.openDialog).toBeNull();
    });
  });

  describe("link editor", () => {
    it("should not submit the link", async () => {
      await render(<Excalidraw handleKeyboardGlobally />);
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([rectangle]);
      API.setSelectedElements([rectangle]);
      API.setAppState({ showHyperlinkPopup: "editor" });

      const input = await waitFor(() => {
        const element = document.querySelector(
          ".excalidraw-hyperlinkContainer-input",
        );
        expect(element).not.toBeNull();
        return element as HTMLInputElement;
      });
      fireEvent.change(input, {
        target: { value: "https://example.com/日本" },
      });

      composingKeyDown(input, KEYS.ENTER);
      composingKeyDown(input, KEYS.ESCAPE);
      expect(h.state.showHyperlinkPopup).toBe("editor");
      expect(h.elements[0].link).toBeNull();

      fireEvent.keyDown(input, { key: KEYS.ENTER });
      expect(h.state.showHyperlinkPopup).toBe("info");
      expect(h.elements[0].link).toBe("https://example.com/日本");
    });
  });

  describe("element link dialog", () => {
    it("should neither confirm nor close", async () => {
      await render(<Excalidraw handleKeyboardGlobally />);
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([rectangle]);
      API.setAppState({
        openDialog: {
          name: "elementLinkSelector",
          sourceElementId: rectangle.id,
        },
      });

      const input = await waitFor(() => {
        const element = document.querySelector(
          ".ElementLinkDialog__input-field input, input.ElementLinkDialog__input-field",
        );
        expect(element).not.toBeNull();
        return element as HTMLInputElement;
      });

      composingKeyDown(input, KEYS.ENTER);
      composingKeyDown(input, KEYS.ESCAPE);
      expect(h.state.openDialog?.name).toBe("elementLinkSelector");

      fireEvent.keyDown(input, { key: KEYS.ESCAPE });
      expect(h.state.openDialog).toBeNull();
    });
  });

  describe("frame name", () => {
    it("should keep editing the name", async () => {
      await render(<Excalidraw handleKeyboardGlobally />);
      const frame = API.createElement({
        type: "frame",
        width: 100,
        height: 100,
      });
      API.setElements([frame]);
      API.setAppState({ editingFrame: frame.id });

      const input = await waitFor(() => {
        const element = document.querySelector(
          ".excalidraw input[value='Frame']",
        );
        expect(element).not.toBeNull();
        return element as HTMLInputElement;
      });

      composingKeyDown(input, KEYS.ENTER);
      composingKeyDown(input, KEYS.ESCAPE);
      expect(h.state.editingFrame).toBe(frame.id);

      fireEvent.keyDown(input, { key: KEYS.ENTER });
      expect(h.state.editingFrame).toBeNull();
    });
  });

  describe("font picker", () => {
    it("should neither pick a font nor close", async () => {
      const { queryByTestId } = await render(
        <Excalidraw handleKeyboardGlobally />,
      );
      UI.clickTool("text");
      act(() => {
        queryByTestId("font-family-show-fonts")!.click();
      });

      const input = await waitFor(() => {
        const element = document.querySelector(".QuickSearch__input");
        expect(element).not.toBeNull();
        return element as HTMLInputElement;
      });

      const fontFamily = h.state.currentItemFontFamily;

      composingKeyDown(input, KEYS.ARROW_DOWN);
      composingKeyDown(input, KEYS.ENTER);
      await flushTimers();
      expect(h.state.currentItemFontFamily).toBe(fontFamily);
      expect(h.state.openPopup).toBe("fontFamily");

      fireEvent.keyDown(input, { key: KEYS.ARROW_DOWN });
      fireEvent.keyDown(input, { key: KEYS.ENTER });
      await waitFor(() =>
        expect(h.state.currentItemFontFamily).not.toBe(fontFamily),
      );
    });
  });

  describe("library search", () => {
    it("should neither clear the search nor close the sidebar", async () => {
      await render(
        <Excalidraw
          handleKeyboardGlobally
          initialData={{
            libraryItems: [
              {
                id: "item",
                status: "unpublished",
                elements: [API.createElement({ type: "rectangle" })],
                created: 0,
              },
            ],
          }}
        />,
      );
      API.setAppState({
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: LIBRARY_SIDEBAR_TAB },
      });

      const input = await waitFor(() => {
        const element = document.querySelector(
          ".library-menu-items-container__search input, input.library-menu-items-container__search",
        );
        expect(element).not.toBeNull();
        return element as HTMLInputElement;
      });
      fireEvent.change(input, { target: { value: "にほんご" } });

      composingKeyDown(input, KEYS.ESCAPE);
      expect(input.value).toBe("にほんご");
      expect(h.state.openSidebar).not.toBeNull();

      fireEvent.keyDown(input, { key: KEYS.ESCAPE });
      expect(input.value).toBe("");
    });
  });

  describe("stats", () => {
    it("should not apply the value", async () => {
      await render(<Excalidraw handleKeyboardGlobally />);
      const rectangle = API.createElement({
        type: "rectangle",
        width: 100,
        height: 100,
      });
      API.setElements([rectangle]);
      API.setSelectedElements([rectangle]);
      API.setAppState({ stats: { open: true, panels: 3 } });

      const input = await waitFor(() => {
        const element =
          UI.queryStatsProperty("W")?.querySelector(".drag-input");
        expect(element).toBeTruthy();
        return element as HTMLInputElement;
      });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "150" } });

      composingKeyDown(input, KEYS.ENTER);
      expect(h.elements[0].width).toBe(100);

      fireEvent.keyDown(input, { key: KEYS.ENTER });
      expect(h.elements[0].width).toBe(150);
    });
  });
});
