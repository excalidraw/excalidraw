import { vi } from "vitest";

import { KEYS, reseed } from "@excalidraw/common";

import ExcalidrawApp from "excalidraw-app/App";

import * as StaticScene from "@excalidraw/excalidraw/renderer/staticScene";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  fireEvent,
  render,
  unmountComponent,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { recentCommandsHistory } from "@excalidraw/excalidraw/components/CommandPalette/hooks/useRecentCommands";

vi.mock("@excalidraw/excalidraw/analytics", () => ({
  trackEvent: vi.fn(),
}));

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
const trackEventMock = vi.mocked(trackEvent);

const { h } = window;

describe("CommandPalette", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    renderStaticScene.mockClear();
    trackEventMock.mockClear();
    reseed(7);

    await render(<ExcalidrawApp />);
  });

  describe("opening and closing", () => {
    it("should open command palette with Cmd+Shift+P", async () => {
      expect(h.state.openDialog).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      expect(trackEventMock).toHaveBeenCalledWith(
        "command_palette",
        "open",
        "shortcut",
      );

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should open command palette with Cmd+/", async () => {
      expect(h.state.openDialog).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyDown(KEYS.SLASH);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      expect(trackEventMock).toHaveBeenCalledWith(
        "command_palette",
        "open",
        "shortcut",
      );

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should close command palette with same shortcut", async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toBeNull();

      const dialog = screen.queryByTestId("command-palette-dialog");
      expect(dialog).toBeNull();
    });

    it("should close command palette with Escape key", async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const dialog = screen.getByTestId("command-palette-dialog");
      fireEvent.keyDown(dialog, { key: KEYS.ESCAPE });

      expect(h.state.openDialog).toBeNull();

      const dialogAfterClose = screen.queryByTestId("command-palette-dialog");
      expect(dialogAfterClose).toBeNull();
    });

    it("should close command palette when clicking outside", async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const modalBackground = document.querySelector(".Modal__background");
      expect(modalBackground).toBeInTheDocument();

      if (modalBackground) {
        fireEvent.click(modalBackground);
      }

      expect(h.state.openDialog).toBeNull();

      const dialog = screen.queryByTestId("command-palette-dialog");
      expect(dialog).toBeNull();
    });

    it("should not render when dialog is not open", () => {
      expect(h.state.openDialog).toBeNull();
      const dialog = screen.queryByTestId("command-palette-dialog");
      expect(dialog).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should focus search input when opened", async () => {
      const input = screen.getByRole("combobox").querySelector("input");

      expect(input).not.toBeNull();
      expect(document.activeElement).toBe(input);
    });

    it("should filter commands based on search query", async () => {
      const input = screen.getByRole("combobox").querySelector("input");

      if (!input) {
        return;
      }

      const query = "chat";
      fireEvent.change(input, { target: { value: query } });

      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      expect(
        commandItems.some((item) => item.textContent?.includes(query)),
      ).toBe(true);
    });

    it("should show no results message when no commands match", async () => {
      const input = screen.getByRole("combobox").querySelector("input");

      if (!input) {
        return;
      }

      fireEvent.change(input, {
        target: { value: "nonexistentcommand" },
      });

      const noMatch = screen.getByText("No matching commands...");
      expect(noMatch).toBeInTheDocument();
    });

    it("should clear search when closing palette", async () => {
      const input = screen.getByRole("combobox").querySelector("input");

      if (!input) {
        return;
      }

      fireEvent.change(input, { target: { value: "test" } });
      expect(input.value).toBe("test");

      const dialog = screen.getByTestId("command-palette-dialog");
      fireEvent.keyDown(dialog, { key: KEYS.ESCAPE });

      expect(h.state.openDialog).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const newSearchInput = screen
        .getByRole("combobox")
        .querySelector("input");
      expect(newSearchInput?.value).toBe("");
    });
  });

  describe("keyboard navigation", () => {
    beforeEach(async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should navigate through commands with arrow keys", async () => {
      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      const selectedCommand = screen.queryByRole("option", {
        selected: true,
      });

      expect(selectedCommand).toEqual(commandItems[0]);

      Keyboard.keyDown(KEYS.ARROW_DOWN);
      const newSelected = screen.queryByRole("option", {
        selected: true,
      });
      expect(newSelected).toEqual(commandItems[1]);

      Keyboard.keyDown(KEYS.ARROW_UP);
      const backToInitial = screen.queryByRole("option", {
        selected: true,
      });
      expect(backToInitial).toEqual(commandItems[0]);
    });

    it("should wrap navigation at boundaries", async () => {
      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(1);

      const selectedCommand = screen.queryByRole("option", {
        selected: true,
      });

      expect(selectedCommand).toEqual(commandItems[0]);

      Keyboard.keyDown(KEYS.ARROW_DOWN);
      const newSelected = screen.queryByRole("option", {
        selected: true,
      });
      expect(newSelected).toEqual(commandItems[1]);

      for (let i = 0; i < commandItems.length - 1; i++) {
        Keyboard.keyDown(KEYS.ARROW_DOWN);
      }

      const backToInitial = screen.queryByRole("option", {
        selected: true,
      });
      expect(backToInitial).toBe(selectedCommand);
    });

    it("should execute command with Enter key", async () => {
      const executeCommandSpy = vi.fn();

      const originalExecuteAction = h.app.actionManager.executeAction;
      h.app.actionManager.executeAction = executeCommandSpy;

      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      Keyboard.keyDown(KEYS.ENTER);

      await waitFor(() => {
        expect(h.state.openDialog).toBeNull();
      });

      h.app.actionManager.executeAction = originalExecuteAction;
    });

    it("should focus search input when typing alphanumeric characters", async () => {
      const input = screen.getByRole("combobox").querySelector("input");

      if (!input) {
        return;
      }

      Keyboard.keyDown("a");
      expect(document.activeElement).toBe(input);
    });
  });

  describe("mouse interactions", () => {
    beforeEach(async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should select command on mouse hover", async () => {
      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(1);

      const secondCommand = commandItems[1];

      fireEvent.mouseMove(secondCommand);

      expect(secondCommand).toHaveAttribute("aria-selected", "true");
    });

    it("should execute command on click", async () => {
      const executeCommandSpy = vi.fn();

      const originalExecuteAction = h.app.actionManager.executeAction;
      h.app.actionManager.executeAction = executeCommandSpy;

      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      const firstCommand = commandItems[0];
      fireEvent.click(firstCommand);

      await waitFor(() => expect(h.state.openDialog).toBeNull());

      h.app.actionManager.executeAction = originalExecuteAction;
    });

    it("should not execute disabled commands", async () => {
      API.setElements([]);
      API.setSelectedElements([]);

      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      const disabledCommands = commandItems.filter(
        (item) => item.getAttribute("aria-disabled") === "true",
      );

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      if (disabledCommands.length > 0) {
        const disabledCommand = disabledCommands[0];

        fireEvent.click(disabledCommand);

        expect(h.state.openDialog).toEqual({ name: "commandPalette" });
      }
    });
  });

  describe("recent commands", () => {
    beforeEach(async () => {
      editorJotaiStore.set(recentCommandsHistory, []);
    });

    it("should show recent commands section when available", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      API.setSelectedElements([h.elements[0]]);
      const COMMAND_NAME = "Increase font size";

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const command = screen.getByRole("option", {
        name: COMMAND_NAME,
      });

      if (!command) {
        return;
      }

      fireEvent.click(command);

      expect(h.state.openDialog).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const recentSection = screen.getByTestId("command-category-recent");
      expect(recentSection).toBeInTheDocument();

      const recentCommandTitle = screen.getByTestId(
        "command-category-title-recent",
      );
      expect(recentCommandTitle).toBeInTheDocument();
      expect(recentCommandTitle?.textContent).toContain("(selection)");

      const recentCommand = recentSection.querySelector("[role='option']");
      expect(recentCommand).toBeInTheDocument();
      expect(recentCommand?.textContent).toContain(COMMAND_NAME);
    });

    it("should not display selection-specific recent commands when no elements are selected", async () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      API.setSelectedElements([h.elements[0]]);
      const COMMAND_NAME = "Increase font size";

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      const command = screen.getByRole("option", { name: COMMAND_NAME });
      fireEvent.click(command);
      expect(h.state.openDialog).toBeNull();

      API.setSelectedElements([]);

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const recentSection = screen.queryByTestId("command-category-recent");
      expect(recentSection).not.toBeInTheDocument();
    });

    it("should show element-specific command when element is selected and global command when not selected", async () => {
      const GLOBAL_COMMAND_NAME = "Toggle theme";

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      const globalCommand = screen.getByRole("option", {
        name: GLOBAL_COMMAND_NAME,
      });
      fireEvent.click(globalCommand);
      expect(h.state.openDialog).toBeNull();

      API.setElements([API.createElement({ type: "rectangle" })]);
      API.setSelectedElements([h.elements[0]]);

      const ELEMENT_COMMAND_NAME = "Increase font size";

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      const elementCommand = screen.getByRole("option", {
        name: ELEMENT_COMMAND_NAME,
      });
      fireEvent.click(elementCommand);
      expect(h.state.openDialog).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      const recentSection = screen.getByTestId("command-category-recent");
      let recentCommand = recentSection.querySelector("[role='option']");
      expect(recentCommand).toBeInTheDocument();
      expect(recentCommand?.textContent).toContain(ELEMENT_COMMAND_NAME);

      const dialog = screen.getByTestId("command-palette-dialog");
      fireEvent.keyDown(dialog, { key: KEYS.ESCAPE });
      expect(h.state.openDialog).toBeNull();

      API.setSelectedElements([]);

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      const recentSectionAfterDeselect = screen.getByTestId(
        "command-category-recent",
      );

      recentCommand =
        recentSectionAfterDeselect.querySelector("[role='option']");
      expect(recentCommand).toBeInTheDocument();
      expect(recentCommand?.textContent).toContain(GLOBAL_COMMAND_NAME);
    });
  });

  describe("command categories", () => {
    beforeEach(async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should display commands grouped by categories", async () => {
      const categories = screen.queryAllByRole("group");
      expect(categories.length).toBeGreaterThan(0);

      categories.forEach((category) => {
        const title = category.querySelector(".command-category-title");
        expect(title).not.toBeNull();
      });
    });

    it("should show category titles", async () => {
      const categoryTitles = screen.queryAllByRole("heading");
      expect(categoryTitles.length).toBeGreaterThan(0);

      categoryTitles.forEach((title) => {
        expect(title.textContent?.trim()).not.toBe("");
      });
    });
  });

  describe("commands display", () => {
    beforeEach(async () => {
      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const dialog = screen.getByTestId("command-palette-dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should display command labels", async () => {
      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      commandItems.forEach((item) => {
        const nameElement = item.querySelector(".name");
        expect(nameElement).not.toBeNull();
        expect(nameElement?.textContent?.trim()).not.toBe("");
      });
    });

    it("should display keyboard shortcuts on desktop", async () => {
      Object.defineProperty(h.app.device.viewport, "isMobile", {
        value: false,
        writable: true,
      });

      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(0);

      const itemsWithShortcuts = commandItems.filter((item) =>
        item.querySelector(".shortcut"),
      );

      expect(itemsWithShortcuts.length).toBeGreaterThan(0);
    });

    it("should hide keyboard shortcuts on mobile", async () => {
      Object.defineProperty(h.app.device.viewport, "isMobile", {
        value: true,
        writable: true,
      });

      const dialog = screen.getByTestId("command-palette-dialog");
      fireEvent.keyDown(dialog, { key: KEYS.ESCAPE });
      expect(h.state.openDialog).toBeNull();

      Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
        Keyboard.keyDown(KEYS.P);
      });

      expect(h.state.openDialog).toEqual({ name: "commandPalette" });

      const shortcutsWrapper = document.querySelectorAll(".shortcut");
      expect(shortcutsWrapper.length).toBe(0);
    });

    it("should scroll selected command into view", async () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const commandItems = screen.queryAllByRole("option");
      expect(commandItems.length).toBeGreaterThan(1);

      Keyboard.keyDown(KEYS.ARROW_DOWN);

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
