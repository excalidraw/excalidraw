import { FONT_FAMILY, KEYS } from "@excalidraw/common";
import { beforeAll } from "vitest";

import { Excalidraw } from "../..";
import { Keyboard, Pointer } from "../../tests/helpers/ui";
import { fireEvent, render, screen, waitFor } from "../../tests/test-utils";

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
});
