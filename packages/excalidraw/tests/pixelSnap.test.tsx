import React from "react";

import { Excalidraw } from "../index";
import { snapScrollToDevicePixels } from "../renderer/helpers";

import { API } from "./helpers/api";
import { GlobalTestState, render, waitFor } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

type CanvasEvent = {
  type: string;
  transform: [number, number, number, number, number, number];
  props: { dx: number; dy: number; dWidth: number };
};

/** the static canvas's element blits, in device pixels */
const getBlits = () => {
  const context = GlobalTestState.canvas.getContext("2d") as any;
  return (context.__getEvents() as CanvasEvent[])
    .filter((event) => event.type === "drawImage")
    .map(({ transform: [a, b, c, d, e, f], props }) => ({
      // the matrix's scale, whatever its rotation
      scale: Math.hypot(a, b),
      x: a * props.dx + c * props.dy + e,
      y: b * props.dx + d * props.dy + f,
      width: props.dWidth,
    }));
};

/** re-renders at the given viewport and returns that render's blits */
const renderAt = async (zoom: number, scrollX: number, scrollY: number) => {
  (GlobalTestState.canvas.getContext("2d") as any).__clearEvents();
  API.setAppState({
    zoom: { value: zoom as NormalizedZoomValue },
    scrollX,
    scrollY,
  });
  return waitFor(() => {
    // the static scene renders on the next frame
    const blits = getBlits().filter(
      (blit) => Math.abs(blit.scale - zoom) < 1e-9,
    );
    expect(blits.length).toBeGreaterThan(0);
    return blits;
  });
};

const distanceToWholePixel = ({ x, y }: { x: number; y: number }) =>
  Math.abs(x - Math.round(x)) + Math.abs(y - Math.round(y));

describe("element pixel snap", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    // jsdom gives the editor no size, which culls every element
    API.setAppState({ width: 800, height: 600 });
  });

  it.each([
    ["text", { type: "text" as const, text: "hello" }],
    ["rectangle", { type: "rectangle" as const, width: 120, height: 60 }],
  ])(
    "blits an unrotated %s on whole device pixels at any zoom",
    async (_, props) => {
      API.setElements([API.createElement({ x: 10.37, y: 20.61, ...props })]);
      for (const zoom of [1, 1.5, 0.73, 2.2]) {
        const blits = await renderAt(zoom, 3.3, -7.77);
        for (const blit of blits) {
          expect(distanceToWholePixel(blit)).toBeLessThan(1e-6);
        }
      }
    },
  );

  it.each([Math.PI / 2, (3 * Math.PI) / 2])(
    "snaps a right-angle rotation (%s rad) without displacing it",
    async (angle) => {
      API.setElements([
        API.createElement({
          type: "rectangle",
          x: 110.37,
          y: 120.61,
          width: 120,
          height: 60,
          angle: angle as any,
        }),
      ]);
      const blits = await renderAt(1.5, 3.3, -7.77);
      for (const blit of blits) {
        expect(distanceToWholePixel(blit)).toBeLessThan(1e-6);
        // and it stays where the element is — a formula that divides by the
        // near-zero diagonal of a rotation sends it far offscreen
        expect(Math.abs(blit.x)).toBeLessThan(2000);
        expect(Math.abs(blit.y)).toBeLessThan(2000);
      }
    },
  );

  it("does not snap while a zoom gesture keeps the cached bitmaps", async () => {
    API.setElements([
      API.createElement({ type: "text", x: 10.37, y: 20.61, text: "hello" }),
    ]);
    // the bitmaps are resampled during the gesture; rounding would only
    // make elements twitch
    await renderAt(1, 0, 0);
    (GlobalTestState.canvas.getContext("2d") as any).__clearEvents();
    API.setAppState({
      shouldCacheIgnoreZoom: true,
      zoom: { value: 1.5 as NormalizedZoomValue },
      scrollX: 3.3,
      scrollY: -7.77,
    });
    const [blit] = await waitFor(() => {
      const blits = getBlits();
      expect(blits.length).toBeGreaterThan(0);
      return blits;
    });
    expect(distanceToWholePixel(blit)).toBeGreaterThan(1e-3);
    API.setAppState({ shouldCacheIgnoreZoom: false });
  });

  it.each([
    // a plain fractional offset, and one that is exactly half a device pixel
    // at 150% (51 scene units → 76.5), where the float noise of a drag used
    // to flip the rounding between two neighbors
    ["fractional", { box: [100.3, 100.3], label: [150.7, 140.2] }],
    ["half-pixel tie", { box: [10, 10], label: [61, 30] }],
  ])(
    "keeps a label at a constant device offset from its container while dragged (%s)",
    async (_, { box, label }) => {
      const offsets = new Set<string>();
      for (const drag of [0, 0.3, 0.4, 0.7, 1.4]) {
        API.setElements([
          API.createElement({
            type: "rectangle",
            id: "box",
            x: box[0] + drag,
            y: box[1] + drag,
            width: 200,
            height: 100,
            boundElements: [{ type: "text", id: "label" }],
          }),
          API.createElement({
            type: "text",
            id: "label",
            x: label[0] + drag,
            y: label[1] + drag,
            text: "hi",
            fontSize: 20,
            containerId: "box",
          }),
        ]);
        const blits = await renderAt(1.5, 3.3, -7.77);
        expect(blits).toHaveLength(2);
        for (const blit of blits) {
          expect(distanceToWholePixel(blit)).toBeLessThan(1e-6);
        }
        // the container's bitmap is the wider one
        const [labelBlit, boxBlit] = [...blits].sort(
          (p, q) => p.width - q.width,
        );
        offsets.add(`${labelBlit.x - boxBlit.x},${labelBlit.y - boxBlit.y}`);
      }
      expect(offsets.size).toBe(1);
    },
  );

  it("leaves rotated elements alone", async () => {
    API.setElements([
      API.createElement({
        type: "text",
        x: 10.37,
        y: 20.61,
        text: "hello",
        angle: 0.4 as any,
      }),
    ]);
    (GlobalTestState.canvas.getContext("2d") as any).__clearEvents();
    API.setAppState({
      zoom: { value: 1.5 as NormalizedZoomValue },
      scrollX: 3.3,
      scrollY: -7.77,
    });
    // a rotated blit is resampled regardless; at these coordinates its
    // unsnapped offset is not a whole pixel
    const [blit] = await waitFor(() => {
      const blits = getBlits();
      expect(blits.length).toBeGreaterThan(0);
      return blits;
    });
    expect(distanceToWholePixel(blit)).toBeGreaterThan(1e-3);
  });
});

describe("scroll pixel snap", () => {
  it("rounds the scroll to whole device pixels and is identity when it already is", () => {
    const zoom = { value: 1.5 as NormalizedZoomValue };
    const snapped = snapScrollToDevicePixels(
      { scrollX: 3.3, scrollY: -7.77, zoom },
      2,
    );
    // 3.3 × 1.5 × 2 = 9.9 → 10;  -7.77 × 3 = -23.31 → -23
    expect(snapped.scrollX * 3).toBeCloseTo(10, 9);
    expect(snapped.scrollY * 3).toBeCloseTo(-23, 9);

    const whole = { scrollX: 4, scrollY: -6, zoom };
    expect(snapScrollToDevicePixels(whole, 2)).toBe(whole);
  });

  it("blits a shape at integer coordinates on whole device pixels at any fractional scroll", async () => {
    await render(<Excalidraw />);
    API.setAppState({ width: 800, height: 600 });
    API.setElements([
      API.createElement({
        type: "rectangle",
        x: 100,
        y: 200,
        width: 200,
        height: 100,
      }),
    ]);
    // zooms at which the element canvas's padding is itself whole device
    // pixels, so the only fractional term left is the scroll
    for (const zoom of [1, 1.5]) {
      const [atFirst] = await renderAt(zoom, 3.3, -7.77);
      expect(distanceToWholePixel(atFirst)).toBeLessThan(1e-6);
      // a tenth of a device pixel further lands on the same pixels
      const [atSecond] = await renderAt(zoom, 3.3 + 0.1 / zoom, -7.77);
      expect(atSecond).toEqual(atFirst);
    }
  });
});

describe("grid pixel snap", () => {
  /** the static canvas's path starts, in device pixels */
  const getPathStarts = () => {
    const context = GlobalTestState.canvas.getContext("2d") as any;
    return (context.__getEvents() as CanvasEvent[])
      .filter((event) => event.type === "moveTo")
      .map(({ transform: [a, , , d, e, f], props }) => ({
        scale: a,
        x: a * (props as any).x + e,
        y: d * (props as any).y + f,
      }));
  };
  const fraction = (value: number) => value - Math.floor(value);

  it("centers one-pixel grid lines on device pixels at any zoom", async () => {
    await render(<Excalidraw />);
    API.setAppState({ width: 800, height: 600, gridModeEnabled: true });
    // zooms at which a grid line is at least a device pixel wide — 1.9
    // included, where `(1 / zoom) × zoom` evaluates just under 1
    for (const zoom of [1, 1.5, 1.9, 2.2]) {
      (GlobalTestState.canvas.getContext("2d") as any).__clearEvents();
      API.setAppState({
        zoom: { value: zoom as NormalizedZoomValue },
        scrollX: 3.3,
        scrollY: -7.77,
      });
      const lines = await waitFor(() => {
        const starts = getPathStarts().filter(
          (start) => Math.abs(start.scale - zoom) < 1e-9,
        );
        expect(starts.length).toBeGreaterThan(0);
        return starts;
      });
      for (const line of lines) {
        // a vertical line has its x on the half pixel, a horizontal its y
        const onHalfPixel =
          Math.abs(fraction(line.x) - 0.5) < 1e-6 ||
          Math.abs(fraction(line.y) - 0.5) < 1e-6;
        expect(onHalfPixel).toBe(true);
      }
    }
  });
});
