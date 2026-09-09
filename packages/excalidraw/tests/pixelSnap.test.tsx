import React from "react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { GlobalTestState, render, waitFor } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

type CanvasEvent = {
  type: string;
  transform: [number, number, number, number, number, number];
  props: { dx: number; dy: number };
};

/** the static canvas's element blits, in device pixels */
const getBlits = () => {
  const context = GlobalTestState.canvas.getContext("2d") as any;
  return (context.__getEvents() as CanvasEvent[])
    .filter((event) => event.type === "drawImage")
    .map(({ transform: [a, , , d, e, f], props }) => ({
      scale: a,
      x: a * props.dx + e,
      y: d * props.dy + f,
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
