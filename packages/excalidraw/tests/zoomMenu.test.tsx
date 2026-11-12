import React from "react";

import { Excalidraw } from "../index";

import {
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

const { h } = window;

const getTrigger = () =>
  document.querySelector<HTMLElement>("[data-testid='zoom-menu-trigger']")!;
const getMenu = () => document.querySelector<HTMLElement>(".zoom-menu");

describe("zoom menu", () => {
  beforeEach(() => {
    mockBoundingClientRect({
      top: 0,
      left: 0,
      bottom: 1080,
      right: 1920,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("lists the zoom actions with their shortcuts, and runs the selected one", async () => {
    await render(<Excalidraw />);

    expect(getTrigger().textContent).toBe("100%");
    expect(getMenu()).toBe(null);

    fireEvent.click(getTrigger());
    expect(
      [...getMenu()!.querySelectorAll("button")].map((item) =>
        item.getAttribute("data-testid"),
      ),
    ).toEqual([
      "zoom-menu-zoomIn",
      "zoom-menu-zoomOut",
      "zoom-menu-zoomToFit",
      "zoom-menu-zoomToFitSelectionInViewport",
      "zoom-menu-resetZoom",
    ]);
    const getItemText = (name: string) =>
      getMenu()!.querySelector(`[data-testid='zoom-menu-${name}']`)!
        .textContent;
    expect(getItemText("zoomToFit")).toBe("Zoom to fitShift+1");
    expect(getItemText("zoomToFitSelectionInViewport")).toBe(
      "Zoom to selectionShift+2",
    );
    expect(getItemText("resetZoom")).toBe("Reset zoomShift+0");

    fireEvent.click(
      getMenu()!.querySelector("[data-testid='zoom-menu-zoomIn']")!,
    );
    expect(h.state.zoom.value).toBeGreaterThan(1);
    expect(getTrigger().textContent).toBe("110%");
    expect(getMenu()).toBe(null);
  });
});
