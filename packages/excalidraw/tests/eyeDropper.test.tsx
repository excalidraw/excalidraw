import React from "react";
import { vi } from "vitest";

import { THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { Pointer, UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  render,
  togglePopover,
  waitFor,
} from "./test-utils";

const mouse = new Pointer("mouse");
const { h } = window;

describe("EyeDropper", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("renders preview without theme filter", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    togglePopover("Background");

    const eyeDropperTrigger =
      document.querySelector<HTMLDivElement>(".excalidraw-eye-dropper-trigger");

    expect(eyeDropperTrigger).toBeTruthy();

    fireEvent.click(eyeDropperTrigger!);

    await waitFor(() => {
      expect(
        document.querySelector<HTMLDivElement>(".excalidraw-eye-dropper-preview"),
      ).toBeTruthy();
    });

    const colorPreview = document.querySelector<HTMLDivElement>(
      ".excalidraw-eye-dropper-preview",
    );

    expect(colorPreview?.style.filter).toBe("none");
  });

  it("applies original color when sampling in dark theme", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    act(() => {
      h.setState({ theme: THEME.DARK });
    });

    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    togglePopover("Background");

    const eyeDropperTrigger =
      document.querySelector<HTMLDivElement>(".excalidraw-eye-dropper-trigger");
    fireEvent.click(eyeDropperTrigger!);

    await waitFor(() => {
      expect(
        document.querySelector<HTMLDivElement>(".excalidraw-eye-dropper-backdrop"),
      ).toBeTruthy();
    });

    const backdrop = document.querySelector<HTMLDivElement>(
      ".excalidraw-eye-dropper-backdrop",
    );
    fireEvent.pointerUp(backdrop!, {
      clientX: 50,
      clientY: 50,
    });

    expect(h.state.currentItemBackgroundColor).toBe("#ffffff");
  });
});
