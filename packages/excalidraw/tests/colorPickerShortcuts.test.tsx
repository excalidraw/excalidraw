import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard, UI } from "./helpers/ui";
import { GlobalTestState, act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

describe("color picker eyedropper shortcuts (#9410)", () => {
  beforeEach(async () => {
    // Needed for radix-ui popover (same as FontPicker / togglePopover tests)
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

    await render(<Excalidraw autoFocus handleKeyboardGlobally />);
  });

  it("opens the stroke color picker with S", () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);

    expect(h.state.openPopup).toBe("elementStroke");
  });

  it("toggles the eyedropper with I while the stroke picker is open", async () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    Keyboard.keyPress(KEYS.I);

    await waitFor(() => {
      const preview = GlobalTestState.renderResult.container.querySelector(
        ".excalidraw-eye-dropper-preview",
      );
      expect(preview).not.toBeNull();
    });
  });

  it("toggles the eyedropper with I while the hex field is focused", async () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    // Focus the hex input (as tabbing to the hex section would)
    const hexInput = GlobalTestState.renderResult.container.querySelector(
      ".color-picker-input",
    ) as HTMLInputElement;
    expect(hexInput).not.toBeNull();
    act(() => {
      hexInput.focus();
    });
    expect(document.activeElement).toBe(hexInput);

    // I must activate the eyedropper, not type into the hex field
    fireEvent.keyDown(hexInput, { key: KEYS.I });

    await waitFor(() => {
      const preview = GlobalTestState.renderResult.container.querySelector(
        ".excalidraw-eye-dropper-preview",
      );
      expect(preview).not.toBeNull();
    });

    // the hex value must not have gained an "i" character
    expect(hexInput.value.toLowerCase()).not.toContain("i");
  });

  it("keeps the eyedropper shortcut working after reusing the picker several times", async () => {
    UI.clickTool("rectangle");

    for (let i = 0; i < 4; i++) {
      Keyboard.keyPress(KEYS.S);
      expect(h.state.openPopup).toBe("elementStroke");

      // close the popup the way repeated usage does (outside click path)
      act(() => {
        h.app.setState({ openPopup: null });
      });
      await waitFor(() => {
        expect(h.state.openPopup).toBeNull();
      });
    }

    // reopen: the eyedropper shortcut must still work (no stale hex focus)
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    const hexInput = GlobalTestState.renderResult.container.querySelector(
      ".color-picker-input",
    ) as HTMLInputElement | null;

    Keyboard.keyPress(KEYS.I);

    await waitFor(() => {
      const preview = GlobalTestState.renderResult.container.querySelector(
        ".excalidraw-eye-dropper-preview",
      );
      expect(preview).not.toBeNull();
    });

    if (hexInput) {
      expect(hexInput.value.toLowerCase()).not.toContain("i");
    }
  });

  it("does not auto-focus the hex field when the stroke picker reopens", async () => {
    UI.clickTool("rectangle");

    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    // deliberately focus the hex field
    const hexInput = GlobalTestState.renderResult.container.querySelector(
      ".color-picker-input",
    ) as HTMLInputElement;
    act(() => {
      hexInput.focus();
    });
    expect(document.activeElement).toBe(hexInput);

    // close via app state, then reopen
    act(() => {
      h.app.setState({ openPopup: null });
    });
    await waitFor(() => {
      expect(h.state.openPopup).toBeNull();
    });

    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    // the hex input must not have stolen focus on reopen
    await waitFor(() => {
      const input = GlobalTestState.renderResult.container.querySelector(
        ".color-picker-input",
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      expect(document.activeElement).not.toBe(input);
    });
  });
});
