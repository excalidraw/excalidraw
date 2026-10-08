import React from "react";

import { elementWithCanvasCache } from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import {
  act,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const STROKES = 50;

beforeEach(() => {
  mockBoundingClientRect({ width: 1920, height: 1080 });
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreOriginalGetBoundingClientRect();
});

describe("static scene rendering", () => {
  it("spreads regenerating zoom-stale bitmaps over frames", async () => {
    const elements = Array.from({ length: STROKES }, (_, i) =>
      API.createElement({
        type: "freedraw",
        x: (i % 10) * 40,
        y: Math.floor(i / 10) * 40,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(10, 5),
          pointFrom<LocalPoint>(20, 0),
        ],
      }),
    );
    await render(<Excalidraw initialData={{ elements }} />);
    await waitFor(() =>
      expect(
        h.elements.every((el) => elementWithCanvasCache.get(el)?.zoomValue),
      ).toBe(true),
    );

    // every regeneration costs 1ms of the per-frame budget
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now++);
    const createElement = document.createElement.bind(document);
    let canvases = 0;
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string, options?: ElementCreationOptions) => {
        if (tagName === "canvas") {
          canvases++;
        }
        return createElement(tagName, options);
      },
    );

    act(() => h.setState({ zoom: { value: 0.5 as any } }));

    // the first frame regenerates only a budget's worth
    expect(canvases).toBeGreaterThan(0);
    expect(canvases).toBeLessThan(STROKES / 2);

    // the rest follow on later frames
    await waitFor(() =>
      expect(
        h.elements.every(
          (el) => elementWithCanvasCache.get(el)?.zoomValue === 0.5,
        ),
      ).toBe(true),
    );
  });

  it("keeps note-taking work proportional to the viewport while scrolling down a 10000x10000 canvas", async () => {
    // handwritten notes scattered over a big canvas, drawn with a pen while
    // scrolling down, as when taking long notes
    const CANVAS_SIZE = 10000;
    const RANDOM_STROKES = 1000;
    const VIEWPORT = { width: 1920, height: 1080 };
    let seed = 42;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const randomStroke = () =>
      Array.from({ length: 20 }, (_, i) =>
        pointFrom<LocalPoint>(i * 3, Math.round((random() - 0.5) * 20)),
      );

    const elements = Array.from({ length: RANDOM_STROKES }, () =>
      API.createElement({
        type: "freedraw",
        x: random() * CANVAS_SIZE,
        y: random() * CANVAS_SIZE,
        points: randomStroke(),
      }),
    );
    await render(<Excalidraw initialData={{ elements }} />);

    const createElement = document.createElement.bind(document);
    let canvases = 0;
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string, options?: ElementCreationOptions) => {
        if (tagName === "canvas") {
          canvases++;
        }
        return createElement(tagName, options);
      },
    );

    const pen = new Pointer("pen");
    UI.clickTool("freedraw");

    for (let top = 0; top < CANVAS_SIZE; top += VIEWPORT.height / 2) {
      act(() => h.setState({ scrollX: 0, scrollY: -top }));
      canvases = 0;

      // write a line of notes in the middle of the viewport
      const points = randomStroke();
      pen.downAt(200, VIEWPORT.height / 2);
      points.forEach(([x, y]) => pen.moveTo(200 + x, VIEWPORT.height / 2 + y));
      pen.upAt();

      const note = h.elements[h.elements.length - 1];
      expect(note.type).toBe("freedraw");
      expect(note.y).toBeCloseTo(top + VIEWPORT.height / 2, 0);

      // bitmaps are only generated for strokes on screen, never for the
      // whole canvas
      const onScreen = h.elements.filter(
        (el) => el.y >= top - 100 && el.y <= top + VIEWPORT.height + 100,
      ).length;
      expect(canvases).toBeGreaterThan(0);
      expect(canvases).toBeLessThanOrEqual(onScreen + points.length + 2);
    }

    expect(h.elements.length).toBe(
      RANDOM_STROKES + Math.ceil(CANVAS_SIZE / (VIEWPORT.height / 2)),
    );
  });

  it("paints a pan over the last frame, redrawing only along the edges", async () => {
    const COLUMNS = 20;
    const elements = Array.from({ length: STROKES * 4 }, (_, i) =>
      API.createElement({
        type: "freedraw",
        x: (i % COLUMNS) * 40,
        y: Math.floor(i / COLUMNS) * 40,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(10, 5),
          pointFrom<LocalPoint>(20, 0),
        ],
      }),
    );
    await render(<Excalidraw initialData={{ elements }} />);
    const { canvas } = GlobalTestState;
    const context = canvas.getContext("2d") as any;
    const getBlits = () =>
      (context.__getEvents() as { type: string; props: { img: unknown } }[])
        .filter((event) => event.type === "drawImage")
        .map((event) => event.props.img);
    const paintAfter = async (update: () => void) => {
      context.__clearEvents();
      act(update);
      await waitFor(() => expect(getBlits().length).toBeGreaterThan(0));
      return getBlits();
    };
    await waitFor(() =>
      expect(h.elements.every((el) => elementWithCanvasCache.get(el))).toBe(
        true,
      ),
    );

    const panned = await paintAfter(() =>
      h.setState({ scrollX: h.state.scrollX + 10 }),
    );
    // the last frame, moved over by the scroll
    expect(panned[0]).toBe(canvas);
    // plus the strokes along the exposed strip and the viewport edges
    expect(panned.length - 1).toBeLessThan(elements.length / 4);

    // any other change repaints everything
    const selected = await paintAfter(() =>
      h.setState({ selectedElementIds: { [h.elements[0].id]: true } }),
    );
    expect(selected).not.toContain(canvas);
    expect(selected.length).toBe(elements.length);
  });

  it("repaints everything on a pan while the grid is shown", async () => {
    const elements = Array.from({ length: 20 }, (_, i) =>
      API.createElement({ type: "rectangle", x: i * 40, y: 0 }),
    );
    await render(<Excalidraw initialData={{ elements }} gridModeEnabled />);
    const { canvas } = GlobalTestState;
    const context = canvas.getContext("2d") as any;
    await waitFor(() =>
      expect(h.elements.every((el) => elementWithCanvasCache.get(el))).toBe(
        true,
      ),
    );
    context.__clearEvents();
    act(() => h.setState({ scrollX: h.state.scrollX + 10 }));
    await waitFor(() =>
      expect(
        context.__getEvents().filter((e: any) => e.type === "drawImage").length,
      ).toBeGreaterThan(0),
    );
    const blits = context
      .__getEvents()
      .filter((e: any) => e.type === "drawImage")
      .map((e: any) => e.props.img);
    expect(blits).not.toContain(canvas);
  });
});
