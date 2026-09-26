import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard, UI } from "./helpers/ui";
import { GlobalTestState, act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

const eyeDropperPreview = () =>
  GlobalTestState.renderResult.container.querySelector(
    ".excalidraw-eye-dropper-preview",
  );

const hexInput = () =>
  GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
    ".color-picker-input",
  );

describe("color picker shortcuts (#9410)", () => {
  beforeAll(() => {
    // radix popovers (font family, color picker) need a ResizeObserver;
    // jsdom has none (same stub as test-utils' togglePopover)
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  });

  beforeEach(async () => {
    await render(<Excalidraw autoFocus handleKeyboardGlobally />);
  });

  it("opens stroke color picker with S", () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);

    expect(h.state.openPopup).toBe("elementStroke");
  });

  it("toggles eyedropper with I while stroke picker is open", async () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    Keyboard.keyPress(KEYS.I);

    await waitFor(() => {
      expect(eyeDropperPreview()).not.toBeNull();
    });
  });

  it("toggles eyedropper with I when hex field is focused", async () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    const input = hexInput();
    expect(input).not.toBeNull();
    act(() => {
      input!.focus();
    });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input!, { key: KEYS.I });

    await waitFor(() => {
      expect(eyeDropperPreview()).not.toBeNull();
    });

    expect(input!.value.toLowerCase()).not.toContain("i");
  });

  it("keeps the eyedropper shortcut working after reusing the picker", async () => {
    UI.clickTool("rectangle");

    for (let i = 0; i < 4; i++) {
      Keyboard.keyPress(KEYS.S);
      expect(h.state.openPopup).toBe("elementStroke");

      act(() => {
        h.app.setState({ openPopup: null });
      });
      await waitFor(() => {
        expect(h.state.openPopup).toBeNull();
      });
    }

    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    const input = hexInput();

    Keyboard.keyPress(KEYS.I);

    await waitFor(() => {
      expect(eyeDropperPreview()).not.toBeNull();
    });

    if (input) {
      expect(input.value.toLowerCase()).not.toContain("i");
    }
  });

  it("does not auto-focus hex when stroke picker is reopened", async () => {
    UI.clickTool("rectangle");

    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");
    const input = hexInput()!;
    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);

    act(() => {
      h.app.setState({ openPopup: null });
    });
    await waitFor(() => {
      expect(h.state.openPopup).toBeNull();
    });

    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    await waitFor(() => {
      expect(hexInput()).not.toBeNull();
      expect(document.activeElement).not.toBe(hexInput());
    });

    Keyboard.keyPress(KEYS.I);
    await waitFor(() => {
      expect(eyeDropperPreview()).not.toBeNull();
    });
  });
});
