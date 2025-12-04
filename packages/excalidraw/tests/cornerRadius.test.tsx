import React from "react";

import { ROUNDNESS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, fireEvent, render, screen } from "../tests/test-utils";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";

const { h } = window;

const mouse = new Pointer("mouse");

describe("corner radius", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    // affects node v16+
    await act(async () => {});
  });

  it("should show corner radius slider when round is selected", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    const element = API.getSelectedElement();
    expect(element.type).toBe("rectangle");

    // Initially sharp
    expect(element.roundness).toBe(null);

    // Click round
    fireEvent.click(screen.getByTitle("Round"));

    const updatedElement = API.getSelectedElement();
    expect(updatedElement.roundness).not.toBe(null);
    expect(updatedElement.roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);

    // Slider should be visible
    const slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeTruthy();
  });

  it("should hide corner radius slider when sharp is selected", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    // Click round first
    fireEvent.click(screen.getByTitle("Round"));

    // Verify slider is visible
    let slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeTruthy();

    // Click sharp
    fireEvent.click(screen.getByTitle("Sharp"));

    const element = API.getSelectedElement();
    expect(element.roundness).toBe(null);

    // Slider should be hidden
    slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeFalsy();
  });

  it("should not show corner radius slider for arrows", async () => {
    UI.clickTool("arrow");
    mouse.down(10, 10);
    mouse.up(100, 100);

    const element = API.getSelectedElement();
    expect(element.type).toBe("arrow");

    // Click round
    fireEvent.click(screen.getByTitle("Round"));

    // Slider should NOT be visible for arrows
    const slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeFalsy();
  });

  it("should not show corner radius slider for diamonds (proportional radius)", async () => {
    UI.clickTool("diamond");
    mouse.down(10, 10);
    mouse.up(100, 100);

    const element = API.getSelectedElement();
    expect(element.type).toBe("diamond");

    // Click round
    fireEvent.click(screen.getByTitle("Round"));

    const updatedElement = API.getSelectedElement();
    expect(updatedElement.roundness?.type).toBe(ROUNDNESS.PROPORTIONAL_RADIUS);

    // Slider should NOT be visible for diamonds (use proportional radius)
    const slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeFalsy();
  });

  it("should update corner radius value when slider is changed", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    // Click round
    fireEvent.click(screen.getByTitle("Round"));

    const slider = screen.getByTestId("cornerRadius-slider");
    expect(slider).toBeTruthy();

    // Change slider value to 50
    fireEvent.change(slider, { target: { value: "50" } });

    const element = API.getSelectedElement();
    expect(element.roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
    expect(element.roundness?.value).toBe(50);
  });

  it("should show minimum radius for multi-selection with different radii", async () => {
    // Create first rectangle with radius 32 (default)
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);
    fireEvent.click(screen.getByTitle("Round"));

    mouse.reset();

    // Create second rectangle with radius 60
    UI.clickTool("rectangle");
    mouse.down(150, 10);
    mouse.up(240, 100);
    fireEvent.click(screen.getByTitle("Round"));
    const slider = screen.getByTestId("cornerRadius-slider");
    fireEvent.change(slider, { target: { value: "60" } });

    mouse.reset();

    // Select both rectangles
    API.setSelectedElements([h.elements[0], h.elements[1]]);

    // Slider should show minimum radius (32)
    const sliderAfterSelection = screen.getByTestId("cornerRadius-slider");
    expect(sliderAfterSelection).toBeTruthy();
    expect((sliderAfterSelection as HTMLInputElement).value).toBe("32");
  });

  it("should calculate correct maximum radius based on element dimensions", async () => {
    // Create small rectangle (50x50)
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(60, 60);
    fireEvent.click(screen.getByTitle("Round"));

    const slider = screen.getByTestId("cornerRadius-slider");
    const maxRadius = (slider as HTMLInputElement).max;

    // Max should be min(50, 50) / 2 = 25
    expect(parseInt(maxRadius, 10)).toBe(25);
  });

  it("should preserve radius value at 0 (not convert to null)", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    // Click round
    fireEvent.click(screen.getByTitle("Round"));

    // Set radius to 0
    const slider = screen.getByTestId("cornerRadius-slider");
    fireEvent.change(slider, { target: { value: "0" } });

    const element = API.getSelectedElement();
    expect(element.roundness).not.toBe(null);
    expect(element.roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
    expect(element.roundness?.value).toBe(0);
  });

  it("should reset to default radius when toggling from sharp to round", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    // Click round and set custom radius
    fireEvent.click(screen.getByTitle("Round"));
    const slider = screen.getByTestId("cornerRadius-slider");
    fireEvent.change(slider, { target: { value: "80" } });

    let element = API.getSelectedElement();
    expect(element.roundness?.value).toBe(80);

    // Click sharp
    fireEvent.click(screen.getByTitle("Sharp"));

    element = API.getSelectedElement();
    expect(element.roundness).toBe(null);

    // Click round again - should use default
    fireEvent.click(screen.getByTitle("Round"));

    element = API.getSelectedElement();
    expect(element.roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
    // When no custom value is set, it should use DEFAULT_ADAPTIVE_RADIUS
    expect(element.roundness?.value).toBeUndefined();
  });

  it("should support undo/redo for radius changes", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    // Click round
    fireEvent.click(screen.getByTitle("Round"));

    const slider = screen.getByTestId("cornerRadius-slider");
    fireEvent.change(slider, { target: { value: "40" } });

    let element = API.getSelectedElement();
    expect(element.roundness?.value).toBe(40);

    // Undo
    const undoAction = createUndoAction(h.history);
    const redoAction = createRedoAction(h.history);

    API.executeAction(undoAction);

    element = API.getSelectedElement();
    expect(element.roundness?.value).toBeUndefined();

    // Redo
    API.executeAction(redoAction);

    element = API.getSelectedElement();
    expect(element.roundness?.value).toBe(40);
  });

  it("should show slider for images, iframes, and embeddables with adaptive radius", async () => {
    // Test with image
    const imageElement = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });

    API.setSelectedElements([imageElement]);

    // Slider should be visible
    let slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeTruthy();

    // Test with iframe
    const iframeElement = API.createElement({
      type: "iframe",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });

    API.setSelectedElements([iframeElement]);

    slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeTruthy();

    // Test with embeddable
    const embeddableElement = API.createElement({
      type: "embeddable",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });

    API.setSelectedElements([embeddableElement]);

    slider = screen.queryByTestId("cornerRadius-slider");
    expect(slider).toBeTruthy();
  });

  it("should cap maximum radius at 200px for very large elements", async () => {
    // Create very large rectangle (1000x1000)
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(1010, 1010);
    fireEvent.click(screen.getByTitle("Round"));

    const slider = screen.getByTestId("cornerRadius-slider");
    const maxRadius = (slider as HTMLInputElement).max;

    // Max should be capped at 200, not 500 (min(1000, 1000) / 2)
    expect(parseInt(maxRadius, 10)).toBe(200);
  });
});
