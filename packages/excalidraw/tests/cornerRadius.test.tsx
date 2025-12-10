// MINIMAL TEST FILE - DO NOT EXCEED 100 LINES
import React from "react";

import { ROUNDNESS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, fireEvent, render, screen } from "./test-utils";

describe("Corner Radius", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("stores roundness.value on rectangle", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });
    API.updateScene({ elements: [rect] });
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 25 },
    });
    expect(API.getElement(rect).roundness?.value).toBe(25);
  });

  it("updates roundness.value via updateElement", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });
    API.updateScene({ elements: [rect] });
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 10 },
    });
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 40 },
    });
    expect(API.getElement(rect).roundness?.value).toBe(40);
  });

  it("shows slider when round rectangle selected", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });
    API.updateScene({ elements: [rect] });
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
    });
    API.setSelectedElements([rect]);

    expect(screen.queryByTestId("corner-radius-slider")).not.toBeNull();
  });

  it("slider changes update element", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });
    API.updateScene({ elements: [rect] });
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 20 },
    });
    API.setSelectedElements([rect]);

    const slider = screen.getByTestId("corner-radius-slider");
    fireEvent.change(slider, { target: { value: "35" } });

    expect(API.getElement(rect).roundness?.value).toBe(35);
  });

  it("value persists after deselect/reselect", () => {
    const rect = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });
    API.updateScene({ elements: [rect] });
    API.updateElement(rect, {
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 42 },
    });

    API.setSelectedElements([rect]);
    API.clearSelection();
    API.setSelectedElements([rect]);

    expect(API.getElement(rect).roundness?.value).toBe(42);
  });
});
