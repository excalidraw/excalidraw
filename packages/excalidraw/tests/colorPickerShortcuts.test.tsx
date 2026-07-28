import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard, UI } from "./helpers/ui";
import {
  GlobalTestState,
  act,
  fireEvent,
  render,
  waitFor,
} from "./test-utils";

const { h } = window;

describe("color picker shortcuts (#9410)", () => {
  beforeEach(async () => {
    // Needed for radix-ui popover (same as FontPicker / togglePopover)
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

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
      const preview =
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        );
      expect(preview).not.toBeNull();
    });
  });

  it("still toggles eyedropper with I when hex section is active", async () => {
    UI.clickTool("rectangle");
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    // Force the hex section (simulates leftover state / user tabbing to hex)
    const hexInput =
      GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
        ".color-picker-input",
      );
    expect(hexInput).not.toBeNull();
    act(() => {
      hexInput!.focus();
    });
    // focusing sets active section to "hex"
    expect(document.activeElement).toBe(hexInput);

    // I must activate eyedropper, not type into the hex field
    fireEvent.keyDown(hexInput!, { key: KEYS.I });

    await waitFor(() => {
      const preview =
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        );
      expect(preview).not.toBeNull();
    });

    // hex value should not have gained an "i" character
    expect(hexInput!.value.toLowerCase()).not.toContain("i");
  });

  it("does not auto-focus hex when stroke picker is reopened", async () => {
    UI.clickTool("rectangle");

    // Open and focus hex
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");
    const hexInput =
      GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
        ".color-picker-input",
      )!;
    act(() => {
      hexInput.focus();
    });
    expect(document.activeElement).toBe(hexInput);

    // Close via app state (Escape while focused on hex only blurs to eyedropper)
    act(() => {
      h.app.setState({ openPopup: null });
    });
    await waitFor(() => {
      expect(h.state.openPopup).toBeNull();
    });

    // Reopen — must not leave hex as the focused section
    Keyboard.keyPress(KEYS.S);
    expect(h.state.openPopup).toBe("elementStroke");

    await waitFor(() => {
      const input =
        GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
          ".color-picker-input",
        );
      expect(input).not.toBeNull();
      expect(document.activeElement).not.toBe(input);
    });

    Keyboard.keyPress(KEYS.I);
    await waitFor(() => {
      expect(
        GlobalTestState.renderResult.container.querySelector(
          ".excalidraw-eye-dropper-preview",
        ),
      ).not.toBeNull();
    });
  });
});
