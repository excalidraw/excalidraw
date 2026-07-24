import React from "react";

import { FONT_SIZES } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw } from "../..";
import { API } from "../../tests/helpers/api";
import { Pointer, UI } from "../../tests/helpers/ui";
import { fireEvent, queryByTestId, render } from "../../tests/test-utils";

const { h } = window;

beforeAll(() => {
  (global as any).ResizeObserver =
    (global as any).ResizeObserver ||
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

describe("FontSizePicker", () => {
  // --- inline presets (S/M/L/XL) ---

  describe("inline presets", () => {
    it("clicking each preset applies the correct fontSize", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 30 } }} />,
      );

      UI.clickTool("text");
      expect(h.state.currentItemFontSize).toBe(30);

      fireEvent.click(queryByTestId(container, "fontSize-small")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.sm);

      fireEvent.click(queryByTestId(container, "fontSize-medium")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.md);

      fireEvent.click(queryByTestId(container, "fontSize-large")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.lg);

      fireEvent.click(queryByTestId(container, "fontSize-veryLarge")!);
      expect(h.state.currentItemFontSize).toBe(FONT_SIZES.xl);
    });

    it("preset fontSize is applied to a newly created text element", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 30 } }} />,
      );

      UI.clickTool("text");
      fireEvent.click(queryByTestId(container, "fontSize-large")!);

      const mouse = new Pointer("mouse");
      mouse.clickAt(100, 100);

      expect((h.elements[0] as ExcalidrawTextElement).fontSize).toBe(
        FONT_SIZES.lg,
      );
    });

    it("active preset highlights correctly", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 36 } }} />,
      );

      UI.clickTool("text");

      const xlButton = queryByTestId(container, "fontSize-veryLarge")!;
      expect(xlButton.classList.contains("active")).toBe(true);

      const smButton = queryByTestId(container, "fontSize-small")!;
      expect(smButton.classList.contains("active")).toBe(false);
    });

    it("no preset is highlighted for a non-standard size", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 50 } }} />,
      );

      UI.clickTool("text");

      const presets = [
        "fontSize-small",
        "fontSize-medium",
        "fontSize-large",
        "fontSize-veryLarge",
      ];
      for (const id of presets) {
        expect(queryByTestId(container, id)!.classList.contains("active")).toBe(
          false,
        );
      }
    });
  });

  // --- trigger button ---

  describe("trigger button", () => {
    it("shows current numeric fontSize value", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 28 } }} />,
      );

      UI.clickTool("text");

      const trigger = container.querySelector(".font-size-picker__trigger");
      expect(trigger).not.toBeNull();
      expect(trigger!.textContent).toBe("28");
    });

    it("shows fontSize of a selected text element", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              API.createElement({ type: "text", id: "t1", fontSize: 48 }),
            ],
          }}
        />,
      );

      new Pointer("mouse").clickOn(h.elements[0]);

      const trigger = container.querySelector(".font-size-picker__trigger");
      expect(trigger!.textContent).toBe("48");
    });

    it("rounds fractional fontSize to nearest integer for display", async () => {
      const { container } = await render(
        <Excalidraw
          initialData={{
            elements: [
              API.createElement({
                type: "text",
                id: "t2",
                fontSize: 23.76,
              }),
            ],
          }}
        />,
      );

      new Pointer("mouse").clickOn(h.elements[0]);

      const trigger = container.querySelector(".font-size-picker__trigger");
      expect(trigger!.textContent).toBe("24");
      // internal value must NOT be mutated
      expect((h.elements[0] as ExcalidrawTextElement).fontSize).toBe(23.76);
    });

    it("updates reactively after keyboard shortcut changes fontSize", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 20 } }} />,
      );

      UI.clickTool("text");

      const triggerBefore = container.querySelector(
        ".font-size-picker__trigger",
      );
      expect(triggerBefore!.textContent).toBe("20");

      fireEvent.click(queryByTestId(container, "fontSize-large")!);

      const triggerAfter = container.querySelector(
        ".font-size-picker__trigger",
      );
      expect(triggerAfter!.textContent).toBe("28");
    });
  });

  // --- popover open/close (openPopup state management) ---

  describe("popover open/close", () => {
    it("opening popover sets openPopup='fontSize' without changing fontSize", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 20 } }} />,
      );

      UI.clickTool("text");

      const trigger = container.querySelector(
        ".font-size-picker__trigger",
      ) as HTMLElement;
      fireEvent.click(trigger);

      expect(h.state.openPopup).toBe("fontSize");
      expect(h.state.currentItemFontSize).toBe(20);
    });

    it("toggling trigger again closes popover without changing fontSize", async () => {
      const { container } = await render(
        <Excalidraw initialData={{ appState: { currentItemFontSize: 20 } }} />,
      );

      UI.clickTool("text");

      const trigger = container.querySelector(
        ".font-size-picker__trigger",
      ) as HTMLElement;

      fireEvent.click(trigger);
      expect(h.state.openPopup).toBe("fontSize");

      fireEvent.click(trigger);
      expect(h.state.openPopup).toBe(null);
      expect(h.state.currentItemFontSize).toBe(20);
    });
  });

  // --- FONT_SIZES constant ---

  describe("FONT_SIZES constant", () => {
    it("retains original sm/md/lg/xl values (backward compat)", () => {
      expect(FONT_SIZES.sm).toBe(16);
      expect(FONT_SIZES.md).toBe(20);
      expect(FONT_SIZES.lg).toBe(28);
      expect(FONT_SIZES.xl).toBe(36);
    });

    it("contains all 12 extended sizes", () => {
      expect(Object.keys(FONT_SIZES)).toHaveLength(12);
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
