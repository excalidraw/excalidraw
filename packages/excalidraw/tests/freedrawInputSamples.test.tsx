import React from "react";

import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { Pointer } from "./helpers/ui";
import { act, GlobalTestState, render, unmountComponent } from "./test-utils";

const { h } = window;

const dispatchRawMove = (
  pointerType: "mouse" | "pen",
  pointerId: number,
  clientX: number,
  clientY: number,
  pressure: number,
  coalesced: Array<{ clientX: number; clientY: number; pressure: number }>,
) => {
  const event = new Event("pointermove", { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerType: { value: pointerType },
    pointerId: { value: pointerId },
    pressure: { value: pressure },
    getCoalescedEvents: {
      value: () =>
        coalesced.map(
          (sample) =>
            ({
              ...sample,
              pointerType,
              pointerId,
            } as PointerEvent),
        ),
    },
  });
  act(() => {
    GlobalTestState.interactiveCanvas.dispatchEvent(event);
  });
};

describe.each([
  ["mouse", 71, 0.5],
  ["pen", 72, 0.65],
] as const)("freedraw raw %s samples", (pointerType, pointerId, pressure) => {
  beforeEach(async () => {
    unmountComponent();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    Pointer.resetAll();
    act(() => {
      h.app.setActiveTool({ type: "freedraw" });
    });
  });

  it("keeps coalesced samples and ignores moves from another pointer", () => {
    const pointer = new Pointer(pointerType, pointerId);
    pointer.downAt(100, 200);

    // A palm/second finger can move before the pen's next browser event. It
    // belongs to a different pointer session and must never enter this stroke.
    dispatchRawMove(
      pointerType === "pen" ? "mouse" : "pen",
      999,
      500,
      500,
      0.5,
      [{ clientX: 500, clientY: 500, pressure: 0.5 }],
    );

    // Vitest makes throttleRAF synchronous, so one event carries several real
    // device samples. The old latest-event path kept only (130, 206).
    dispatchRawMove(pointerType, pointerId, 130, 206, pressure, [
      { clientX: 110, clientY: 202, pressure },
      { clientX: 120, clientY: 204, pressure },
      { clientX: 130, clientY: 206, pressure },
    ]);
    pointer.upAt(140, 208);

    const element = h.elements.find(
      (candidate): candidate is ExcalidrawFreeDrawElement =>
        candidate.type === "freedraw" && !candidate.isDeleted,
    );
    expect(element).toBeDefined();
    expect(element!.points).toEqual([
      [0, 0],
      [10, 2],
      [20, 4],
      [30, 6],
      [40, 8],
    ]);
  });
});
