import React from "react";

import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, UI } from "./helpers/ui";
import { fireEvent, render, screen } from "./test-utils";

const { h } = window;

const clickPreset = (name: string) =>
  fireEvent.click(screen.getByTestId(`frame-preset-${name}`));

describe("frame size", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("inserts a frame of a preset size while the frame tool is active", () => {
    Keyboard.keyPress(KEYS.F);
    expect(h.state.activeTool.type).toBe("frame");

    clickPreset("slide16x9");

    expect(h.elements).toHaveLength(1);
    const [frame] = h.elements;
    expect(frame).toMatchObject({ type: "frame", width: 1920, height: 1080 });
    expect(h.state.selectedElementIds).toEqual({ [frame.id]: true });
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("places a new frame to the right of the last one", () => {
    API.setElements([
      API.createElement({
        type: "frame",
        x: 100,
        y: 50,
        width: 400,
        height: 300,
      }),
    ]);

    Keyboard.keyPress(KEYS.F);
    clickPreset("phone");

    expect(h.elements[1]).toMatchObject({
      type: "frame",
      x: 600,
      y: 50,
      width: 390,
      height: 844,
    });
  });

  it("resizes the selected frame and updates its children", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    });
    // outside the frame now, inside once it grows to 1024 × 768
    const rect = API.createElement({
      type: "rectangle",
      x: 500,
      y: 500,
      width: 100,
      height: 100,
    });
    API.updateScene({
      elements: [frame, rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([frame]);

    clickPreset("slide4x3");

    expect(API.getElement(frame)).toMatchObject({
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });
    expect(API.getElement(rect).frameId).toBe(frame.id);
    expect(
      screen.getByTestId("frame-preset-slide4x3").classList.contains("active"),
    ).toBe(true);

    Keyboard.undo();
    expect(API.getElement(frame)).toMatchObject({ width: 400, height: 300 });
  });

  it("switches orientation, and presets keep it", () => {
    const frame = API.createElement({
      type: "frame",
      width: 1920,
      height: 1080,
    });
    API.setElements([frame]);
    API.setSelectedElements([frame]);

    fireEvent.click(screen.getByTestId("frame-orientation-portrait"));
    expect(API.getElement(frame)).toMatchObject({ width: 1080, height: 1920 });
    // matched in either orientation
    expect(
      screen.getByTestId("frame-preset-slide16x9").classList.contains("active"),
    ).toBe(true);

    clickPreset("slide4x3");
    expect(API.getElement(frame)).toMatchObject({ width: 768, height: 1024 });

    fireEvent.click(screen.getByTestId("frame-orientation-landscape"));
    expect(API.getElement(frame)).toMatchObject({ width: 1024, height: 768 });
  });

  it("describes presets in their tooltips", () => {
    Keyboard.keyPress(KEYS.F);

    expect(screen.getByTestId("frame-preset-phone").title).toBe(
      "Phone · 390 × 844",
    );
  });

  it("isn't offered for other elements", () => {
    const rect = API.createElement({ type: "rectangle" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);
    UI.clickTool("selection");

    expect(screen.queryByTestId("frame-preset-slide16x9")).toBe(null);
  });
});
