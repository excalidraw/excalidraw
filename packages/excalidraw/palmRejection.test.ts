import { describe, expect, it } from "vitest";

import {
  LARGE_CONTACT_PX,
  PINCH_CONFIRM_WINDOW_MS,
  PalmRejectionGate,
  getContactSize,
} from "./palmRejection";

import type {
  PalmRejectionEvent,
  PalmRejectionEventType,
  PalmRejectionOptions,
} from "./palmRejection";

const touch = (
  type: PalmRejectionEventType,
  pointerId: number,
  extra: Partial<PalmRejectionEvent> = {},
): PalmRejectionEvent => ({
  type,
  pointerId,
  pointerType: "touch",
  isPrimary: false,
  ...extra,
});

const SIZE: PalmRejectionOptions = { allowPinch: false, useContactSize: true };
const PINCH: PalmRejectionOptions = { allowPinch: true, useContactSize: false };
const BOTH: PalmRejectionOptions = { allowPinch: true, useContactSize: true };

describe("PalmRejectionGate: first touch wins", () => {
  it("accepts a single touch for its whole lifetime", () => {
    const gate = new PalmRejectionGate();
    const primary = { isPrimary: true };
    expect(gate.evaluate(touch("pointerdown", 1, primary))).toBe("accept");
    expect(gate.evaluate(touch("pointermove", 1, primary))).toBe("accept");
    expect(gate.evaluate(touch("pointerup", 1, primary))).toBe("accept");
    expect(gate.ownerPointerId).toBe(null);
  });

  it("rejects a palm that lands while the first touch is drawing", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    expect(gate.evaluate(touch("pointerdown", 2))).toBe("reject");
    expect(gate.evaluate(touch("pointermove", 2))).toBe("reject");
    expect(gate.evaluate(touch("pointermove", 1))).toBe("accept");
    expect(gate.ownerPointerId).toBe(1);
    expect(gate.evaluate(touch("pointerup", 2))).toBe("reject");
    expect(gate.evaluate(touch("pointerup", 1))).toBe("accept");
  });

  it("never promotes a rejected contact to owner mid-stroke", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    gate.evaluate(touch("pointerdown", 2));
    gate.evaluate(touch("pointerdown", 3));
    gate.evaluate(touch("pointerup", 1));
    expect(gate.ownerPointerId).toBe(null);
    expect(gate.evaluate(touch("pointermove", 2))).toBe("reject");
    expect(gate.evaluate(touch("pointermove", 3))).toBe("reject");
    expect(gate.ownerPointerId).toBe(null);
  });

  it("lets the stylus draw again while the palm is still resting", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    gate.evaluate(touch("pointerdown", 2));
    gate.evaluate(touch("pointerup", 1));
    expect(gate.evaluate(touch("pointerdown", 3))).toBe("accept");
    expect(gate.ownerPointerId).toBe(3);
    expect(gate.evaluate(touch("pointermove", 2))).toBe("reject");
  });

  it("releases the owner on pointercancel so no stroke state sticks", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    gate.evaluate(touch("pointerdown", 2));
    expect(gate.evaluate(touch("pointercancel", 1))).toBe("accept");
    expect(gate.ownerPointerId).toBe(null);
    expect(gate.evaluate(touch("pointercancel", 2))).toBe("reject");
    expect(gate.hasRejectedContacts()).toBe(false);
  });

  it("recovers from a missed pointerup via the primary-pointer reset", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    gate.evaluate(touch("pointerdown", 2));
    expect(gate.evaluate(touch("pointerdown", 9, { isPrimary: true }))).toBe(
      "accept",
    );
    expect(gate.ownerPointerId).toBe(9);
    expect(gate.hasRejectedContacts()).toBe(false);
  });

  it("does not affect mouse or pen pointers", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    for (const pointerType of ["mouse", "pen"]) {
      for (const type of ["pointerdown", "pointermove", "pointerup"] as const) {
        expect(
          gate.evaluate({ type, pointerId: 5, pointerType, isPrimary: true }),
        ).toBe("accept");
      }
    }
    expect(gate.ownerPointerId).toBe(1);
  });

  it("accepts untracked pointers (e.g. a touch that began on the UI)", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    expect(gate.isTracked(42)).toBe(false);
    expect(gate.evaluate(touch("pointermove", 42))).toBe("accept");
    expect(gate.evaluate(touch("pointerup", 42))).toBe("accept");
  });

  it("reset() forgets all contacts", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(touch("pointerdown", 1, { isPrimary: true }));
    gate.evaluate(touch("pointerdown", 2));
    gate.reset();
    expect(gate.ownerPointerId).toBe(null);
    expect(gate.isTracked(1)).toBe(false);
    expect(gate.isTracked(2)).toBe(false);
  });
});

describe("PalmRejectionGate: contact size hint", () => {
  it("getContactSize treats 0/1/undefined as unavailable", () => {
    expect(getContactSize({})).toBe(null);
    expect(getContactSize({ width: 0, height: 0 })).toBe(null);
    expect(getContactSize({ width: 1, height: 1 })).toBe(null);
    expect(getContactSize({ width: 12, height: 20 })).toBe(20);
  });

  it("rejects a large palm that lands BEFORE the stylus", () => {
    const gate = new PalmRejectionGate();
    const palm = { isPrimary: true, width: 90, height: 110 };
    expect(gate.evaluate(touch("pointerdown", 1, palm), SIZE)).toBe("reject");
    expect(gate.ownerPointerId).toBe(null);
    // the stylus lands afterwards (not primary: the palm is still down)
    const tip = { width: 20, height: 20 };
    expect(gate.evaluate(touch("pointerdown", 2, tip), SIZE)).toBe("accept");
    expect(gate.ownerPointerId).toBe(2);
    expect(gate.evaluate(touch("pointermove", 1), SIZE)).toBe("reject");
    expect(gate.evaluate(touch("pointermove", 2), SIZE)).toBe("accept");
  });

  it("ignores size entirely when the option is off", () => {
    const gate = new PalmRejectionGate();
    const palm = { isPrimary: true, width: 90, height: 110 };
    expect(gate.evaluate(touch("pointerdown", 1, palm))).toBe("accept");
    expect(gate.ownerPointerId).toBe(1);
  });

  it("never rejects when the browser reports no contact size", () => {
    const gate = new PalmRejectionGate();
    const none = { isPrimary: true, width: 1, height: 1 };
    expect(gate.evaluate(touch("pointerdown", 1, none), SIZE)).toBe("accept");
    expect(gate.evaluate(touch("pointerdown", 2), SIZE)).toBe("reject");
    expect(gate.ownerPointerId).toBe(1);
  });

  it("adapts to the drawing contact: 2x the usual size is a palm", () => {
    const gate = new PalmRejectionGate();
    const tip = { isPrimary: true, width: 20, height: 20 };
    gate.evaluate(touch("pointerdown", 1, tip), SIZE);
    gate.evaluate(touch("pointerup", 1, tip), SIZE);
    expect(gate.drawingContactSize).toBe(20);

    // below the absolute limit, but twice the learned tip size
    const medium = { isPrimary: true, width: 44, height: 40 };
    expect(medium.width).toBeLessThan(LARGE_CONTACT_PX);
    expect(gate.evaluate(touch("pointerdown", 2, medium), SIZE)).toBe("reject");

    // a slightly larger tip is still fine
    const bigger = { width: 28, height: 28 };
    expect(gate.evaluate(touch("pointerdown", 3, bigger), SIZE)).toBe("accept");
  });

  it("a finger-sized drawing contact is not treated as a palm", () => {
    const gate = new PalmRejectionGate();
    const finger = { isPrimary: true, width: 38, height: 40 };
    expect(gate.evaluate(touch("pointerdown", 1, finger), SIZE)).toBe(
      "accept",
    );
  });
});

describe("PalmRejectionGate: two-finger pinch", () => {
  const at = (
    type: PalmRejectionEventType,
    id: number,
    t: number,
    x: number,
    y: number,
    extra: Partial<PalmRejectionEvent> = {},
  ) =>
    touch(type, id, {
      isPrimary: id === 1 && type === "pointerdown",
      timeStamp: t,
      clientX: x,
      clientY: y,
      ...extra,
    });

  /** owner at (0,0), second contact at (200,0), both landed at t=0/10 */
  const landTwo = (gate: PalmRejectionGate, options = PINCH) => {
    expect(gate.evaluate(at("pointerdown", 1, 0, 0, 0), options)).toBe(
      "accept",
    );
    // swallowed while we watch how it moves
    expect(gate.evaluate(at("pointerdown", 2, 10, 200, 0), options)).toBe(
      "reject",
    );
  };

  it("promotes a second finger once both fingers move apart", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    expect(gate.isPinchActive()).toBe(false);

    // only the second finger moved so far: not enough
    expect(gate.evaluate(at("pointermove", 2, 60, 260, 0), PINCH)).toBe(
      "reject",
    );
    // the first finger moves the opposite way: now it is a pinch
    expect(gate.evaluate(at("pointermove", 1, 70, -60, 0), PINCH)).toBe(
      "promote",
    );
    expect(gate.takePromotedContact()).toEqual({ pointerId: 2, x: 260, y: 0 });
    expect(gate.takePromotedContact()).toBe(null);
    expect(gate.isPinchActive()).toBe(true);
    expect(gate.hadPinch()).toBe(true);

    // from here both fingers pass through
    expect(gate.evaluate(at("pointermove", 2, 80, 300, 0), PINCH)).toBe(
      "accept",
    );
    expect(gate.evaluate(at("pointermove", 1, 90, -100, 0), PINCH)).toBe(
      "accept",
    );
  });

  it("can also be promoted by the second finger's own move", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    gate.evaluate(at("pointermove", 1, 50, -60, 0), PINCH);
    expect(gate.evaluate(at("pointermove", 2, 60, 260, 0), PINCH)).toBe(
      "promote",
    );
    expect(gate.isPinchActive()).toBe(true);
  });

  it("pinching works however far apart the fingers land", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(at("pointerdown", 1, 0, 0, 0), PINCH);
    gate.evaluate(at("pointerdown", 2, 10, 900, 600), PINCH);
    gate.evaluate(at("pointermove", 1, 40, -50, -40), PINCH);
    expect(gate.evaluate(at("pointermove", 2, 50, 960, 640), PINCH)).toBe(
      "promote",
    );
  });

  it("never promotes a resting palm that stays put while the pen draws", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    for (let i = 1; i <= 20; i++) {
      const move = at("pointermove", 1, 20 + i * 10, i * 15, 0);
      expect(gate.evaluate(move, PINCH)).toBe("accept");
    }
    expect(gate.isPinchActive()).toBe(false);
    expect(gate.hasRejectedContacts()).toBe(true);
    // the palm only jitters a little
    expect(gate.evaluate(at("pointermove", 2, 300, 204, 3), PINCH)).toBe(
      "reject",
    );
  });

  it("never promotes a palm that drags along with the pen", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    // pen goes right, the palm follows (same direction)
    gate.evaluate(at("pointermove", 1, 50, 120, 0), PINCH);
    expect(gate.evaluate(at("pointermove", 2, 60, 260, 5), PINCH)).toBe(
      "reject",
    );
    gate.evaluate(at("pointermove", 1, 90, 300, 0), PINCH);
    expect(gate.isPinchActive()).toBe(false);
  });

  it("stops watching once the confirmation window has passed", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    const late = PINCH_CONFIRM_WINDOW_MS + 100;
    gate.evaluate(at("pointermove", 1, late, -60, 0), PINCH);
    expect(gate.evaluate(at("pointermove", 2, late + 10, 260, 0), PINCH)).toBe(
      "reject",
    );
    expect(gate.isPinchActive()).toBe(false);
  });

  it("is off unless allowPinch is set", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(at("pointerdown", 1, 0, 0, 0));
    expect(gate.evaluate(at("pointerdown", 2, 10, 200, 0))).toBe("reject");
    gate.evaluate(at("pointermove", 1, 50, -60, 0));
    expect(gate.evaluate(at("pointermove", 2, 60, 260, 0))).toBe("reject");
    expect(gate.isPinchActive()).toBe(false);
  });

  it("never watches a large contact", () => {
    const gate = new PalmRejectionGate();
    gate.evaluate(at("pointerdown", 1, 0, 0, 0), BOTH);
    const palm = at("pointerdown", 2, 10, 200, 0, { width: 90, height: 90 });
    expect(gate.evaluate(palm, BOTH)).toBe("reject");
    gate.evaluate(at("pointermove", 1, 50, -60, 0), BOTH);
    expect(gate.evaluate(at("pointermove", 2, 60, 260, 0), BOTH)).toBe(
      "reject",
    );
    expect(gate.isPinchActive()).toBe(false);
  });

  it("rejects a third contact while a candidate is being watched", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    expect(gate.evaluate(at("pointerdown", 3, 20, 300, 0), PINCH)).toBe(
      "reject",
    );
    expect(gate.evaluate(at("pointermove", 3, 30, 400, 0), PINCH)).toBe(
      "reject",
    );
  });

  it("forgets a candidate that lifts before it proved to be a pinch", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    expect(gate.evaluate(at("pointerup", 2, 100, 200, 0), PINCH)).toBe(
      "reject",
    );
    expect(gate.isTracked(2)).toBe(false);
    expect(gate.hasRejectedContacts()).toBe(false);
    expect(gate.ownerPointerId).toBe(1);
  });

  it("a watched contact becomes a plain resting hand when the pen lifts", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    gate.evaluate(at("pointerup", 1, 100, 0, 0), PINCH);
    expect(gate.hasRejectedContacts()).toBe(true);
    // it must not be able to start a pinch or take over afterwards
    expect(gate.evaluate(at("pointermove", 2, 150, 260, 0), PINCH)).toBe(
      "reject",
    );
    expect(gate.ownerPointerId).toBe(null);
  });

  it("does not turn the remaining finger into a stroke after a pinch", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    gate.evaluate(at("pointermove", 1, 50, -60, 0), PINCH);
    gate.evaluate(at("pointermove", 2, 60, 260, 0), PINCH);
    expect(gate.evaluate(at("pointerup", 2, 200, 260, 0), PINCH)).toBe(
      "accept",
    );
    expect(gate.isPinchActive()).toBe(false);
    expect(gate.evaluate(at("pointermove", 1, 210, -80, 0), PINCH)).toBe(
      "reject",
    );
    // ...but its pointerup still reaches the app for cleanup
    expect(gate.evaluate(at("pointerup", 1, 220, -80, 0), PINCH)).toBe(
      "accept",
    );
    expect(gate.hadPinch()).toBe(false);
  });

  it("handles the owner lifting first in a pinch, then a new stroke", () => {
    const gate = new PalmRejectionGate();
    landTwo(gate);
    gate.evaluate(at("pointermove", 1, 50, -60, 0), PINCH);
    gate.evaluate(at("pointermove", 2, 60, 260, 0), PINCH);
    expect(gate.evaluate(at("pointerup", 1, 200, -60, 0), PINCH)).toBe(
      "accept",
    );
    expect(gate.evaluate(at("pointermove", 2, 210, 280, 0), PINCH)).toBe(
      "reject",
    );
    expect(gate.evaluate(at("pointerup", 2, 220, 280, 0), PINCH)).toBe(
      "accept",
    );
    expect(gate.evaluate(at("pointerdown", 5, 1000, 0, 0), PINCH)).toBe(
      "accept",
    );
    expect(gate.ownerPointerId).toBe(5);
  });
});
