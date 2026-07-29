import React from "react";
import { Excalidraw } from "../index";
import { fireEvent, render, waitFor, toggleMenu, togglePopover } from "./test-utils";

describe("ColorInput error handling", () => {
  const openCanvasBackgroundColorPicker = async () => {
    const { container } = await render(<Excalidraw />);

    // Open main menu to access canvas background color picker
    toggleMenu(container);

    // Set up ResizeObserver for radix-ui components
    (global as any).ResizeObserver = class ResizeObserver {
      constructor(cb: any) {
        (this as any).cb = cb;
      }

      observe() {}

      unobserve() {}
      disconnect() {}
    };

    // Open color picker for canvas background
    const canvasBgButton = container.querySelector(
      '[data-openpopup="canvasBackground"]',
    ) as HTMLButtonElement;
    expect(canvasBgButton).toBeTruthy();
    fireEvent.click(canvasBgButton);

    // Wait for color picker to open
    await waitFor(() => {
      const colorInput = container.querySelector(
        ".color-picker-input",
      ) as HTMLInputElement;
      expect(colorInput).toBeTruthy();
    });

    return container.querySelector(
      ".color-picker-input",
    ) as HTMLInputElement;
  };

  it("shows error for invalid hex length (too short)", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter invalid hex code with length 1
    fireEvent.change(colorInput, { target: { value: "1" } });

    // Check error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain(
        "Hex code must be 3, 4, 6, or 8 characters",
      );
    });
  });

  it("shows error for invalid hex length (too long)", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter invalid hex code with length 9
    fireEvent.change(colorInput, { target: { value: "123456789" } });

    // Check error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain(
        "Hex code must be 3, 4, 6, or 8 characters",
      );
    });
  });

  it("shows error for invalid hex characters", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter invalid hex characters
    fireEvent.change(colorInput, { target: { value: "zzzzzz" } });

    // Check error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain(
        "Invalid characters in hex code",
      );
    });
  });

  it("shows error for non-hex text", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter non-hex text (not a valid color name)
    fireEvent.change(colorInput, { target: { value: "notacolor" } });

    // Check error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain(
        "Invalid characters in hex code",
      );
    });
  });

  it("does not show error for valid hex codes", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter valid hex code
    fireEvent.change(colorInput, { target: { value: "ff0000" } });

    // Check no error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeFalsy();
    });
  });

  it("clears error when input is cleared", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter invalid hex code to trigger error
    fireEvent.change(colorInput, { target: { value: "notacolor" } });

    // Check error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeTruthy();
    });

    // Clear input
    fireEvent.change(colorInput, { target: { value: "" } });

    // Check error message disappears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeFalsy();
    });
  });

  it("clears error when blurring input", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter invalid hex code to trigger error
    fireEvent.change(colorInput, { target: { value: "notacolor" } });

    // Check error message appears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeTruthy();
    });

    // Blur input (simulate clicking outside)
    fireEvent.blur(colorInput);

    // Check error message disappears
    await waitFor(() => {
      const errorMessage = document.querySelector(
        ".color-picker__error-message",
      ) as HTMLElement;
      expect(errorMessage).toBeFalsy();
    });
  });

  it("input has aria-invalid attribute when error is shown", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter invalid hex code to trigger error
    fireEvent.change(colorInput, { target: { value: "notacolor" } });

    // Check aria-invalid attribute is set to true
    await waitFor(() => {
      expect(colorInput.getAttribute("aria-invalid")).toBe("true");
    });
  });

  it("input has aria-invalid attribute set to false when no error", async () => {
    const colorInput = await openCanvasBackgroundColorPicker();

    // Enter valid hex code
    fireEvent.change(colorInput, { target: { value: "ff0000" } });

    // Check aria-invalid attribute is set to false
    await waitFor(() => {
      expect(colorInput.getAttribute("aria-invalid")).toBe("false");
    });
  });
});
