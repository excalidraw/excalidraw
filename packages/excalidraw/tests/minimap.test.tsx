import React from "react";
import { vi } from "vitest";

import { THEME, viewportCoordsToSceneCoords } from "@excalidraw/common";

import { actionToggleMinimap } from "../actions";
import { Excalidraw } from "../index";
import { AnimationController } from "../renderer/animation";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
// see minimap-shared.chunk.ts
const MINIMAP_PADDING = 8;

const getMinimap = () => document.querySelector<HTMLElement>(".minimap");
const getToggle = () =>
  document.querySelector<HTMLElement>("[data-testid='button-minimap']")!;

describe("minimap", () => {
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
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(
      MINIMAP_WIDTH,
    );
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(
      MINIMAP_HEIGHT,
    );
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    vi.restoreAllMocks();
  });

  describe("announcement dot (temporary)", () => {
    const getDot = () => document.querySelector(".minimap-announcement-dot");
    const withContent = {
      elements: [API.createElement({ type: "rectangle" })],
    };

    beforeEach(() => {
      localStorage.clear();
      // before the announcement ends
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 12));
    });

    it("is shown until the minimap is opened", async () => {
      await render(<Excalidraw initialData={withContent} />);
      expect(getDot()).not.toBe(null);

      fireEvent.click(getToggle());
      expect(getDot()).toBe(null);

      // nor in later sessions
      fireEvent.click(getToggle());
      expect(getDot()).toBe(null);
      await render(<Excalidraw initialData={withContent} />);
      expect(getDot()).toBe(null);
    });

    it("isn't shown in a session that loaded an empty canvas", async () => {
      await render(<Excalidraw />);
      expect(getDot()).toBe(null);

      act(() => {
        API.setElements([API.createElement({ type: "rectangle" })]);
      });
      expect(getDot()).toBe(null);

      await render(<Excalidraw initialData={withContent} />);
      expect(getDot()).not.toBe(null);
    });

    it("isn't shown once the announcement is over", async () => {
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 20));
      await render(<Excalidraw initialData={withContent} />);
      expect(getDot()).toBe(null);
    });
  });

  it("is removed with every way to toggle it by ui.disabled.minimap", async () => {
    await render(
      <Excalidraw
        ui={{ disabled: { minimap: true } }}
        initialData={{ appState: { minimapEnabled: true } }}
      />,
    );

    expect(getMinimap()).toBe(null);
    expect(document.querySelector("[data-testid='button-minimap']")).toBe(null);
    // the Preferences item, command palette and context menu go by it
    expect(h.app.actionManager.isActionEnabled(actionToggleMinimap)).toBe(
      false,
    );
    // the rest of the default UI stays
    expect(document.querySelector(".main-menu-trigger")).not.toBe(null);
  });

  it("is toggled by the footer button", async () => {
    await render(<Excalidraw />);

    expect(getMinimap()).toBe(null);
    expect(getToggle().getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(getToggle());
    expect(h.state.minimapEnabled).toBe(true);
    expect(getMinimap()).not.toBe(null);
    expect(getToggle().getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(getToggle());
    expect(h.state.minimapEnabled).toBe(false);
    expect(getMinimap()).toBe(null);
  });

  it("pans the canvas when dragging the viewport, or pressing outside of it", async () => {
    // larger than the viewport, so that the minimap is fitted to it alone
    const content = { width: 4000, height: 2800 };
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({ type: "rectangle", x: 0, y: 0, ...content }),
          ],
          appState: { minimapEnabled: true, scrollX: 0, scrollY: 0 },
        }}
      />,
    );

    const scale = Math.min(
      (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / content.width,
      (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / content.height,
    );
    const translateX = MINIMAP_WIDTH / 2 - (content.width / 2) * scale;
    const translateY = MINIMAP_HEIGHT / 2 - (content.height / 2) * scale;

    const minimap = getMinimap()!;

    // inside of the viewport (wait until the minimap is rendered)
    await waitFor(() => {
      fireEvent.pointerDown(minimap, { clientX: 50, clientY: 30, button: 0 });
      expect(minimap.classList.contains("minimap--dragging")).toBe(true);
    });
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    fireEvent.pointerMove(minimap, { clientX: 70, clientY: 40 });
    expect(h.state.scrollX).toBeCloseTo(-20 / scale);
    expect(h.state.scrollY).toBeCloseTo(-10 / scale);

    fireEvent.pointerUp(minimap, { clientX: 70, clientY: 40 });
    expect(minimap.classList.contains("minimap--dragging")).toBe(false);

    // outside of the viewport: centers it on the pointer
    fireEvent.pointerDown(minimap, { clientX: 180, clientY: 120, button: 0 });
    fireEvent.pointerUp(minimap, { clientX: 180, clientY: 120 });
    expect(h.state.scrollX).toBeCloseTo(
      h.state.width / 2 - (180 - translateX) / scale,
    );
    expect(h.state.scrollY).toBeCloseTo(
      h.state.height / 2 - (120 - translateY) / scale,
    );
  });

  it("zooms around the center of the viewport on wheel", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              x: 0,
              y: 0,
              width: 4000,
              height: 2800,
            }),
          ],
          appState: { minimapEnabled: true, scrollX: 0, scrollY: 0 },
        }}
      />,
    );

    const getViewportCenter = () =>
      viewportCoordsToSceneCoords(
        {
          clientX: h.state.width / 2 + h.state.offsetLeft,
          clientY: h.state.height / 2 + h.state.offsetTop,
        },
        h.state,
      );
    const center = getViewportCenter();

    const minimap = getMinimap()!;
    // away from the viewport (wait until the minimap is set up)
    await waitFor(() => {
      fireEvent.wheel(minimap, { clientX: 180, clientY: 120, deltaY: -100 });
      expect(h.state.zoom.value).toBeGreaterThan(1);
    });

    // zoomed rather than panned (as wheeling over the canvas could)
    expect(getViewportCenter().x).toBeCloseTo(center.x);
    expect(getViewportCenter().y).toBeCloseTo(center.y);
  });

  it("has the theme applied by the time its change is notified (for the colors to be read)", async () => {
    const { container } = await render(<Excalidraw />);
    const editor = container.querySelector(".excalidraw")!;

    let wasDarkWhenNotified: boolean | null = null;
    h.app.onStateChange("theme", () => {
      wasDarkWhenNotified = editor.classList.contains("theme--dark");
    });
    act(() => {
      h.setState({ theme: THEME.DARK });
    });
    expect(wasDarkWhenNotified).toBe(true);
  });

  it("limits dragging the viewport to its own size past the content", async () => {
    const content = { width: 4000, height: 2800 };
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({ type: "rectangle", x: 0, y: 0, ...content }),
          ],
          appState: { minimapEnabled: true, scrollX: 0, scrollY: 0 },
        }}
      />,
    );

    // (a zoom-only lock doesn't constrain scrolling, so it changes nothing)
    act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, h.state.width, h.state.height],
        fit: "none",
        animation: false,
        lock: { zoom: true },
      });
    });
    expect(h.state.scrollConstraints).not.toBe(null);

    const minimap = getMinimap()!;
    await waitFor(() => {
      fireEvent.pointerDown(minimap, { clientX: 50, clientY: 30, button: 0 });
      expect(minimap.classList.contains("minimap--dragging")).toBe(true);
    });

    // far past the bottom-right corner: the content ends up just out of view
    fireEvent.pointerMove(minimap, { clientX: 2000, clientY: 2000 });
    expect(h.state.scrollX).toBe(-content.width);
    expect(h.state.scrollY).toBe(-content.height);

    // ...and the top-left one
    fireEvent.pointerMove(minimap, { clientX: -2000, clientY: -2000 });
    expect(h.state.scrollX).toBe(h.state.width);
    expect(h.state.scrollY).toBe(h.state.height);

    fireEvent.pointerUp(minimap, { clientX: -2000, clientY: -2000 });
  });

  it("keeps panning while the pointer is held outside of the minimap", async () => {
    const content = { width: 4000, height: 2800 };
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({ type: "rectangle", x: 0, y: 0, ...content }),
          ],
          appState: { minimapEnabled: true, scrollX: 0, scrollY: 0 },
        }}
      />,
    );

    const minimap = getMinimap()!;
    await waitFor(() => {
      fireEvent.pointerDown(minimap, { clientX: 50, clientY: 30, button: 0 });
      expect(minimap.classList.contains("minimap--dragging")).toBe(true);
    });

    // inside of the minimap: stays where it was dragged to
    fireEvent.pointerMove(minimap, { clientX: 150, clientY: 30 });
    const draggedScrollX = h.state.scrollX;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(h.state.scrollX).toBe(draggedScrollX);

    // a few px past its right edge: keeps going, up to the limit
    fireEvent.pointerMove(minimap, {
      clientX: MINIMAP_WIDTH + 4,
      clientY: 30,
    });
    const heldScrollX = h.state.scrollX;
    expect(heldScrollX).toBeGreaterThan(-content.width);
    await waitFor(() => expect(h.state.scrollX).toBeLessThan(heldScrollX));
    await waitFor(() => expect(h.state.scrollX).toBe(-content.width));

    fireEvent.pointerUp(minimap, { clientX: MINIMAP_WIDTH + 4, clientY: 30 });
  });

  it("holds the rubberband overscroll until the drag ends", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              x: 0,
              y: 0,
              width: 4000,
              height: 2800,
            }),
          ],
          appState: { minimapEnabled: true },
        }}
      />,
    );
    act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 4000, 2800],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 50 },
      });
    });
    const restingScrollX = h.state.scrollX;

    const minimap = getMinimap()!;
    await waitFor(() => {
      fireEvent.pointerDown(minimap, { clientX: 100, clientY: 70, button: 0 });
      expect(minimap.classList.contains("minimap--dragging")).toBe(true);
    });

    // past the left edge, into the overscroll zone
    fireEvent.pointerMove(minimap, { clientX: 20, clientY: 70 });
    const heldScrollX = h.state.scrollX;
    expect(heldScrollX).toBeGreaterThan(restingScrollX);

    // the debounced snap-back elapses while the pointer is still down
    act(() => {
      // eslint-disable-next-line dot-notation -- private; simulates the debounce delay elapsing
      h.app.viewport["snapBackDebounced"].flush();
    });
    expect(
      AnimationController.running(h.app.viewport.snapBackAnimationKey),
    ).toBe(false);
    expect(h.state.scrollX).toBe(heldScrollX);

    fireEvent.pointerUp(minimap, { clientX: 20, clientY: 70 });
    expect(
      AnimationController.running(h.app.viewport.snapBackAnimationKey),
    ).toBe(true);

    // grabbing it again while it's snapping back holds it once more
    fireEvent.pointerDown(minimap, { clientX: 20, clientY: 70, button: 0 });
    expect(
      AnimationController.running(h.app.viewport.snapBackAnimationKey),
    ).toBe(false);

    fireEvent.pointerUp(minimap, { clientX: 20, clientY: 70 });
    expect(
      AnimationController.running(h.app.viewport.snapBackAnimationKey),
    ).toBe(true);
  });

  it("doesn't refit itself while the released overscroll snaps back", async () => {
    const content = { width: 4000, height: 2000 };
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({ type: "rectangle", x: 0, y: 0, ...content }),
          ],
          appState: { minimapEnabled: true },
        }}
      />,
    );
    act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, content.width, content.height],
        fit: "none",
        animation: false,
        lock: { scroll: true, overscroll: 400 },
      });
    });
    // the minimap is fitted to the content alone (it contains the viewport)
    const scale = (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / content.width;

    const minimap = getMinimap()!;
    await waitFor(() => {
      fireEvent.pointerDown(minimap, { clientX: 100, clientY: 70, button: 0 });
      expect(minimap.classList.contains("minimap--dragging")).toBe(true);
    });
    // past the left edge, into the overscroll zone
    fireEvent.pointerMove(minimap, { clientX: 10, clientY: 70 });
    expect(h.state.scrollX).toBeGreaterThan(0);
    fireEvent.pointerUp(minimap, { clientX: 10, clientY: 70 });

    // a few frames into the snap-back
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    // the pointer still maps to the scene the same way: had the minimap
    // refitted to the content + the overscrolled viewport, it'd be zoomed out
    const scrollX = h.state.scrollX;
    fireEvent.pointerDown(minimap, { clientX: 40, clientY: 70, button: 0 });
    fireEvent.pointerMove(minimap, { clientX: 80, clientY: 70 });
    expect(scrollX - h.state.scrollX).toBeCloseTo(40 / scale, 0);
    fireEvent.pointerUp(minimap, { clientX: 80, clientY: 70 });
  });

  it("keeps the compact styles panel and the pen mode button clear of it", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    await render(
      <Excalidraw
        UIOptions={{ getFormFactor: () => "tablet" }}
        initialData={{
          elements: [rectangle],
          appState: { minimapEnabled: true },
        }}
      />,
    );
    fireEvent.resize(window);
    await waitFor(() =>
      expect(h.app.editorInterface.formFactor).toBe("tablet"),
    );

    const getPanel = () =>
      document.querySelector<HTMLElement>(".compact-shape-actions-island")!;

    API.setSelectedElements([rectangle]);
    await waitFor(() =>
      expect(getPanel().style.maxHeight).toBe(
        `${h.state.height - 166 - 138}px`,
      ),
    );

    act(() => {
      h.setState({ penDetected: true });
    });
    expect(document.querySelector(".ToolIcon__penMode")).not.toBe(null);
    expect(getPanel().style.maxHeight).toBe(
      `${h.state.height - 166 - 138 - 54}px`,
    );
  });

  it("isn't available in editors too short for it", async () => {
    mockBoundingClientRect({
      top: 0,
      left: 0,
      bottom: 400,
      right: 1920,
      width: 1920,
      height: 400,
      x: 0,
      y: 0,
    });
    await render(
      <Excalidraw initialData={{ appState: { minimapEnabled: true } }} />,
    );

    // (the footer itself is rendered)
    expect(document.querySelector(".zoom-actions")).not.toBe(null);
    expect(getToggle()).toBe(null);
    expect(getMinimap()).toBe(null);
  });
});
