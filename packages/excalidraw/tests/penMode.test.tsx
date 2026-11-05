import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { fireEvent, GlobalTestState, render } from "./test-utils";

// Keep the normal synchronous test behavior, but allow one test to queue a
// move until pointerup flushes it, as a real animation frame would.
const throttle = vi.hoisted(() => ({ holding: false }));

vi.mock("../reactUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../reactUtils")>();
  return {
    ...actual,
    withBatchedUpdatesThrottled: (fn: (event: PointerEvent) => void) => {
      const batched = actual.withBatchedUpdates(fn);
      let pending: PointerEvent | null = null;
      const handler = (event: PointerEvent) => {
        if (throttle.holding) {
          pending = event;
        } else {
          batched(event);
        }
      };
      handler.flush = () => {
        const event = pending;
        pending = null;
        if (event) {
          batched(event);
        }
      };
      handler.cancel = () => {
        pending = null;
      };
      return handler;
    },
  };
});

const { h } = window;

const pen = new Pointer("pen", 1);
const palm = new Pointer("touch", 2);

describe("pen mode palm rejection", () => {
  beforeEach(async () => {
    throttle.holding = false;
    await render(<Excalidraw />);
    UI.clickTool("freedraw");
  });

  afterEach(() => {
    // Clear active pointers even when an assertion fails mid-stroke.
    throttle.holding = false;
    pen.upAt();
    palm.upAt();
  });

  it.each(["up", "cancel"])(
    "keeps a pen stroke active when a palm touches, moves, and lifts via %s",
    (end) => {
      pen.downAt(100, 100);
      pen.moveTo(110, 110);
      expect(h.state.penMode).toBe(true);

      const stroke = h.state.newElement as ExcalidrawFreeDrawElement;
      const points = [...stroke.points];
      const { scrollX, scrollY, zoom } = h.state;

      palm.downAt(200, 200);
      palm.moveTo(230, 220);

      expect(h.state.newElement?.id).toBe(stroke.id);
      expect(stroke.points).toEqual(points);
      expect(h.state.scrollX).toBe(scrollX);
      expect(h.state.scrollY).toBe(scrollY);
      expect(h.state.zoom).toEqual(zoom);

      if (end === "up") {
        palm.upAt();
      } else {
        fireEvent.pointerCancel(GlobalTestState.interactiveCanvas, {
          pointerType: "touch",
          pointerId: 2,
          clientX: 230,
          clientY: 220,
        });
      }

      expect(h.state.newElement?.id).toBe(stroke.id);
      pen.moveTo(140, 130);
      expect(stroke.points.length).toBeGreaterThan(points.length);
      pen.upAt();

      expect(h.state.newElement).toBeNull();
      expect(h.elements).toHaveLength(1);
      expect(stroke.points.at(-1)).toEqual([40, 30]);
    },
  );

  it("does not append a touch move outside the canvas to a pen stroke", () => {
    pen.downAt(100, 100);
    pen.moveTo(110, 110);
    const stroke = h.state.newElement as ExcalidrawFreeDrawElement;
    const points = [...stroke.points];

    fireEvent.pointerMove(document.body, {
      pointerType: "touch",
      pointerId: 2,
      clientX: 250,
      clientY: 250,
    });

    expect(stroke.points).toEqual(points);
    pen.upAt();
  });

  it("does not finish a pen stroke when another pointer is released outside the canvas", () => {
    pen.downAt(100, 100);
    pen.moveTo(110, 110);
    const stroke = h.state.newElement!;

    fireEvent.pointerUp(document.body, {
      pointerType: "touch",
      pointerId: 2,
      clientX: 250,
      clientY: 250,
    });

    expect(h.state.newElement?.id).toBe(stroke.id);
    pen.upAt();
  });

  it("preserves a queued pen move when a palm moves in the same animation frame", () => {
    pen.downAt(100, 100);
    pen.moveTo(110, 110);
    const stroke = h.state.newElement as ExcalidrawFreeDrawElement;
    throttle.holding = true;
    pen.moveTo(120, 120);
    fireEvent.pointerMove(document.body, {
      pointerType: "touch",
      pointerId: 2,
      clientX: 250,
      clientY: 250,
    });
    pen.upAt(140, 140);

    expect(stroke.points).toContainEqual([20, 20]);
    expect(stroke.points).not.toContainEqual([150, 150]);
    expect(stroke.points.at(-1)).toEqual([40, 40]);
  });

  it("still ends the stroke when the pen itself is canceled", () => {
    pen.downAt(100, 100);
    pen.moveTo(110, 110);
    fireEvent.pointerCancel(GlobalTestState.interactiveCanvas, {
      pointerType: "pen",
      pointerId: 1,
      clientX: 110,
      clientY: 110,
    });

    expect(h.state.newElement).toBeNull();
    pen.downAt(200, 200);
    pen.moveTo(220, 220);
    pen.upAt();
    expect(h.elements).toHaveLength(2);
  });

  it("finishes the pen stroke even if the palm is still touching the canvas", () => {
    pen.downAt(100, 100);
    pen.moveTo(110, 110);
    palm.downAt(200, 200);
    pen.moveTo(140, 130);
    pen.upAt();

    expect(h.state.newElement).toBeNull();
    const stroke = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(stroke.points.at(-1)).toEqual([40, 30]);
    const points = [...stroke.points];
    palm.moveTo(250, 250);
    palm.upAt();
    expect(stroke.points).toEqual(points);

    pen.downAt(300, 300);
    pen.moveTo(320, 320);
    pen.upAt();
    expect(h.elements).toHaveLength(2);
  });

  it("allows touch to interrupt drawing when pen mode is disabled", () => {
    pen.downAt(100, 100);
    pen.moveTo(110, 110);
    API.setAppState({ penMode: false });
    palm.downAt(200, 200);

    expect(h.state.newElement).toBeNull();
    palm.upAt();
    pen.upAt();
  });

  it("preserves touch-only two-finger panning in pen mode", () => {
    API.setAppState({ penMode: true, penDetected: true });
    const otherFinger = new Pointer("touch", 3);
    const { scrollX, scrollY } = h.state;
    palm.downAt(100, 100);
    otherFinger.downAt(200, 100);
    palm.moveTo(120, 120);
    otherFinger.moveTo(220, 120);
    palm.upAt();
    otherFinger.upAt();

    expect(h.state.scrollX).toBeGreaterThan(scrollX);
    expect(h.state.scrollY).toBeGreaterThan(scrollY);
    expect(h.elements).toHaveLength(0);
  });
});
