import { fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import { MAX_ZOOM, MIN_ZOOM } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { render } from "../tests/test-utils";

const { h } = window;

const queryContainer = (selector: string) =>
  document.querySelector<HTMLElement>(selector);

const openZoomInput = () => {
  const zoomValueButton = queryContainer(".zoom-value-button");
  expect(zoomValueButton).not.toBe(null);
  fireEvent.doubleClick(zoomValueButton!);
  return queryContainer(".zoom-value-input") as HTMLInputElement;
};

const submitZoom = async (value: string) => {
  const input = openZoomInput();
  expect(input).not.toBe(null);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(queryContainer(".zoom-value-input")).toBe(null));
};

describe("zoom value input", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("renders the current zoom as a percentage", () => {
    expect(queryContainer(".zoom-value-button")?.textContent).toBe("100%");
  });

  it("opens an input on double click, seeded with the current zoom", () => {
    const input = openZoomInput();
    expect(input).not.toBe(null);
    expect(input.value).toBe("100");
  });

  it("zooms to the typed percentage", async () => {
    await submitZoom("1800");
    expect(h.state.zoom.value).toBe(18);
    expect(queryContainer(".zoom-value-button")?.textContent).toBe("1800%");
  });

  it("clamps values above MAX_ZOOM", async () => {
    await submitZoom("999999");
    expect(h.state.zoom.value).toBe(MAX_ZOOM);
  });

  it("clamps values below MIN_ZOOM", async () => {
    await submitZoom("1");
    expect(h.state.zoom.value).toBe(MIN_ZOOM);
  });

  it("ignores a non-numeric value", async () => {
    const zoomBefore = h.state.zoom.value;
    await submitZoom("abc");
    expect(h.state.zoom.value).toBe(zoomBefore);
  });

  it("keeps the viewport center anchored", async () => {
    const { width, height, offsetLeft, offsetTop } = h.state;
    const centerX = width / 2 + offsetLeft;
    const centerY = height / 2 + offsetTop;

    const sceneXBefore = centerX / h.state.zoom.value - h.state.scrollX;
    const sceneYBefore = centerY / h.state.zoom.value - h.state.scrollY;

    await submitZoom("400");

    const sceneXAfter = centerX / h.state.zoom.value - h.state.scrollX;
    const sceneYAfter = centerY / h.state.zoom.value - h.state.scrollY;

    expect(sceneXAfter).toBeCloseTo(sceneXBefore);
    expect(sceneYAfter).toBeCloseTo(sceneYBefore);
  });

  it("discards the edit on Escape", async () => {
    const input = openZoomInput();
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(queryContainer(".zoom-value-input")).toBe(null));
    expect(h.state.zoom.value).toBe(1);
  });

  it("commits on blur", async () => {
    const input = openZoomInput();
    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.blur(input);

    await waitFor(() => expect(h.state.zoom.value).toBe(2.5));
  });
});

describe("reset zoom button", () => {
  it("resets zoom to 100% and is separate from the zoom value", async () => {
    await render(<Excalidraw />);

    await submitZoom("400");
    expect(h.state.zoom.value).toBe(4);

    const resetButton = queryContainer(".reset-zoom-button");
    expect(resetButton).not.toBe(null);
    fireEvent.click(resetButton!);

    await waitFor(() => expect(h.state.zoom.value).toBe(1));
  });

  it("does not reset zoom when the zoom value is clicked", async () => {
    await render(<Excalidraw />);

    await submitZoom("400");
    fireEvent.click(queryContainer(".zoom-value-button")!);

    expect(h.state.zoom.value).toBe(4);
  });
});
