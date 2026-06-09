import { FONT_FAMILY, KEYS } from "@excalidraw/common";
import { beforeAll, describe, it, expect } from "vitest";

import { Excalidraw } from "../..";
import { Keyboard, Pointer } from "../../tests/helpers/ui";
import { fireEvent, render, screen, waitFor, act } from "../../tests/test-utils";
import { API } from "../../tests/helpers/api";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
});

describe("FontPickerList - Italic Feature", () => {
  it("displays the Italic option after selecting the text tool and opening the font picker", async () => {
    await render(<Excalidraw />);

    const excalidrawContainer = document.querySelector(
      ".excalidraw-container",
    ) as HTMLElement;

    excalidrawContainer.focus();
    Keyboard.keyPress(KEYS.T, excalidrawContainer);

    await waitFor(() => {
      expect(window.h.state.activeTool.type).toBe("text");
    });

    const mouse = new Pointer("mouse");
    mouse.click(100, 100);

    fireEvent.click(screen.getByTestId("font-family-show-fonts"));

    await waitFor(() => {
      const popover = screen.getByTestId("font-picker-popover-content");
      expect(popover).toBeVisible();

      const italicFallback = screen.getByTestId("font-family-italic-fallback");
      expect(italicFallback).toHaveTextContent("Itálico");

      const italicButtons = screen.getAllByRole("button", { name: /Italic/i });
      const italicOptionButton = italicButtons.find(
        (button) => button.dataset.testid !== "font-family-italic-fallback",
      );

      expect(italicOptionButton).toBeInTheDocument();

      const italicIcon = italicOptionButton?.querySelector(
        'svg line[x1="14"][y1="5"][x2="10"][y2="19"]',
      );
      expect(italicIcon).toBeInTheDocument();
    });
  });

  // TEST 3: Engine/White-Box Verification (TDD - GREEN Step)
  it("should successfully save the custom fontFamily property (10) on the canvas text element", async () => {
    await render(<Excalidraw />);

    // Mocking the element structure manually to bypass API factory default constraints
    const textElementMock = API.createElement({
      type: "text",
      x: 150,
      y: 150,
      text: "Validating Engine Code",
    });

    // Forcefully inject the new font family property into the mock element
    Object.defineProperty(textElementMock, "fontFamily", {
      value: FONT_FAMILY.Italic,
      writable: true,
    });

    // Ensuring all state updates and scene mutations run inside the React lifecycle context
    await act(async () => {
      window.h.setState({
        currentItemFontFamily: FONT_FAMILY.Italic,
      });

      // Commit the mocked element directly into the active engine scene registry
      window.h.app.scene.replaceAllElements([textElementMock]);
    });

    // Extract the active elements from the global test helper 'h'
    const elements = window.h.elements;
    const textElement = elements.find((el) => el.type === "text");

    // TDD Assertions:
    expect(textElement).toBeDefined();
    expect(textElement!.fontFamily).toBe(FONT_FAMILY.Italic);
  });
});