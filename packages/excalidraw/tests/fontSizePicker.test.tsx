import React from "react";

import { FONT_SIZES } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  fireEvent,
  queryByTestId,
  render,
} from "./test-utils";

const { h } = window;

// Radix Popover requires ResizeObserver which jsdom doesn't provide
beforeAll(() => {
  (global as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const openFontSizePopover = (container: HTMLElement) => {
  const trigger = container.querySelector(
    ".font-size-picker__trigger",
  ) as HTMLElement;
  expect(trigger).not.toBeNull();
  fireEvent.click(trigger);
};

describe("FontSizePicker", () => {
  describe("inline presets (S/M/L/XL SVG icons)", () => {
    it("clicking S preset applies fontSize=16", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 30 },
          }}
        />,
      );

      UI.clickTool("text");
      expect(h.state.currentItemFontSize).toBe(30);

      fireEvent.click(queryByTestId(container, "fontSize-sm")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.sm);
    });

    it("clicking M preset applies fontSize=20", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 30 },
          }}
        />,
      );

      UI.clickTool("text");
      fireEvent.click(queryByTestId(container, "fontSize-md")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.md);
    });

    it("clicking L preset applies fontSize=28", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 16 },
          }}
        />,
      );

      UI.clickTool("text");
      fireEvent.click(queryByTestId(container, "fontSize-lg")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.lg);
    });

    it("clicking XL preset applies fontSize=36", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 16 },
          }}
        />,
      );

      UI.clickTool("text");
      fireEvent.click(queryByTestId(container, "fontSize-xl")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.xl);
    });

    it("preset fontSize is applied to created text element", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 30 },
          }}
        />,
      );

      UI.clickTool("text");
      fireEvent.click(queryByTestId(container, "fontSize-lg")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.lg);

      const mouse = new Pointer("mouse");
      mouse.clickAt(100, 100);
      expect(
        (h.elements[0] as ExcalidrawTextElement).fontSize,
      ).toBe(FONT_SIZES.lg);
    });

    it("clicking inline preset closes popover if open", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");

      // Open popover
      openFontSizePopover(container);
      expect(h.state.openPopup).toBe("fontSize");

      // Click inline S preset
      fireEvent.click(queryByTestId(container, "fontSize-sm")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.sm);
      // Popover should be closed
      expect(h.state.openPopup).toBe(null);
    });
  });

  describe("popover trigger (openPopup)", () => {
    it("opening popover does not crash or change fontSize", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");
      expect(h.state.currentItemFontSize).toBe(20);

      openFontSizePopover(container);

      expect(h.state.openPopup).toBe("fontSize");
      expect(h.state.currentItemFontSize).toBe(20);
    });

    it("toggling popover off clears openPopup without changing fontSize", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");

      openFontSizePopover(container);
      expect(h.state.openPopup).toBe("fontSize");

      openFontSizePopover(container);
      expect(h.state.openPopup).toBe(null);
      expect(h.state.currentItemFontSize).toBe(20);
    });
  });

  describe("popover preset buttons (2 rows × 5)", () => {
    it("clicking extended preset in popover applies fontSize", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");

      openFontSizePopover(container);
      expect(h.state.openPopup).toBe("fontSize");

      const preset4xl = queryByTestId(container, "fontSize-popover-4xl");
      expect(preset4xl).not.toBeNull();
      fireEvent.click(preset4xl!);

      expect(h.state.currentItemFontSize).toBe(FONT_SIZES["4xl"]);
    });

    it("clicking smaller preset (XS) in popover applies fontSize", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");
      openFontSizePopover(container);

      const presetXs = queryByTestId(container, "fontSize-popover-xs");
      expect(presetXs).not.toBeNull();
      fireEvent.click(presetXs!);

      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.xs);
    });

    it("clicking 10XL preset in popover applies fontSize", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");
      openFontSizePopover(container);

      const preset10xl = queryByTestId(container, "fontSize-popover-10xl");
      expect(preset10xl).not.toBeNull();
      fireEvent.click(preset10xl!);

      expect(h.state.currentItemFontSize).toBe(FONT_SIZES["10xl"]);
    });
  });

  describe("numeric dropdown", () => {
    it("selecting value from numeric dropdown applies fontSize", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            appState: { currentItemFontSize: 20 },
          }}
        />,
      );

      UI.clickTool("text");
      openFontSizePopover(container);

      const dropdown = queryByTestId(
        container,
        "fontSize-numeric-dropdown",
      ) as HTMLSelectElement;
      expect(dropdown).not.toBeNull();

      fireEvent.change(dropdown, { target: { value: "72" } });
      expect(h.state.currentItemFontSize).toBe(72);
    });
  });

  describe("existing element selection", () => {
    it("selecting text element shows correct fontSize in trigger", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              API.createElement({
                type: "text",
                id: "text1",
                fontSize: 48,
              }),
            ],
          }}
        />,
      );

      const mouse = new Pointer("mouse");
      mouse.clickOn(h.elements[0]);

      const trigger = container.querySelector(
        ".font-size-picker__trigger-value",
      );
      expect(trigger).not.toBeNull();
      expect(trigger!.textContent).toBe("48");
    });
  });

  describe("display rounding", () => {
    it("fractional fontSize is displayed rounded to integer", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              API.createElement({
                type: "text",
                id: "text-frac",
                fontSize: 23.76,
              }),
            ],
          }}
        />,
      );

      const mouse = new Pointer("mouse");
      mouse.clickOn(h.elements[0]);

      const trigger = container.querySelector(
        ".font-size-picker__trigger-value",
      );
      expect(trigger).not.toBeNull();
      expect(trigger!.textContent).toBe("24");
      expect(
        (h.elements[0] as ExcalidrawTextElement).fontSize,
      ).toBe(23.76);
    });
  });

  describe("backward compatibility", () => {
    it("FONT_SIZES retains original values", () => {
      expect(FONT_SIZES.sm).toBe(16);
      expect(FONT_SIZES.md).toBe(20);
      expect(FONT_SIZES.lg).toBe(28);
      expect(FONT_SIZES.xl).toBe(36);
    });

    it("FONT_SIZES has new extended sizes", () => {
      expect(FONT_SIZES["2xs"]).toBe(10);
      expect(FONT_SIZES.xs).toBe(12);
      expect(FONT_SIZES["2xl"]).toBe(48);
      expect(FONT_SIZES["3xl"]).toBe(60);
      expect(FONT_SIZES["4xl"]).toBe(72);
      expect(FONT_SIZES["5xl"]).toBe(84);
      expect(FONT_SIZES["8xl"]).toBe(120);
      expect(FONT_SIZES["10xl"]).toBe(144);
    });
  });
});
