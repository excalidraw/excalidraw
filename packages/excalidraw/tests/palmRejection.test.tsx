import React from "react";

import { TAP_TWICE_TIMEOUT } from "@excalidraw/common";

import {
  actionTogglePalmRejection,
  actionTogglePalmRejectionContactSize,
  actionTogglePalmRejectionPinch,
} from "../actions";
import {
  cleanAppStateForExport,
  clearAppStateForDatabase,
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "../appState";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render } from "./test-utils";

const { h } = window;

const canvas = () => GlobalTestState.interactiveCanvas;

type Contact = {
  id: number;
  /** the first touch of a gesture is flagged primary by browsers */
  primary?: boolean;
  /** contact size as reported by the touchscreen; 1 = "not available" */
  size?: number;
};

const STYLUS: Contact = { id: 1, primary: true, size: 20 };
const PALM: Contact = { id: 2, size: 90 };

const eventInit = (contact: Contact, x: number, y: number) => ({
  pointerId: contact.id,
  pointerType: "touch",
  isPrimary: !!contact.primary,
  clientX: x,
  clientY: y,
  width: contact.size ?? 1,
  height: contact.size ?? 1,
  pressure: 0.5,
});

const down = (contact: Contact, x: number, y: number) =>
  fireEvent.pointerDown(canvas(), eventInit(contact, x, y));
const move = (contact: Contact, x: number, y: number) =>
  fireEvent.pointerMove(canvas(), eventInit(contact, x, y));
const up = (contact: Contact, x: number, y: number) =>
  fireEvent.pointerUp(canvas(), eventInit(contact, x, y));

const getFreedraws = () =>
  h.elements.filter((element) => element.type === "freedraw");

/** dispatches a native touch event carrying `count` simultaneous touches */
const dispatchTouchEvent = (type: "touchstart" | "touchend", count: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: Array.from({ length: count }, (_, i) => ({
      identifier: i,
      clientX: 100 + i * 50,
      clientY: 100,
    })),
  });
  act(() => {
    canvas().dispatchEvent(event);
  });
};

describe("palm rejection", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // lift everything so module-level gesture state doesn't leak across tests
    [1, 2, 3].forEach((id) => up({ id }, 0, 0));
    await act(async () => {});
  });

  describe("settings", () => {
    it("has sensible defaults and is persisted in the browser only", () => {
      const defaults = getDefaultAppState();
      expect(defaults.palmRejection).toBe(false);
      expect(defaults.palmRejectionPinch).toBe(true);
      expect(defaults.palmRejectionContactSize).toBe(false);

      const prefs = {
        palmRejection: true,
        palmRejectionPinch: false,
        palmRejectionContactSize: true,
      };
      expect(clearAppStateForLocalStorage(prefs)).toEqual(prefs);
      expect(cleanAppStateForExport(prefs)).toEqual({});
      expect(clearAppStateForDatabase(prefs)).toEqual({});
    });

    it("toggle actions flip their setting", () => {
      API.executeAction(actionTogglePalmRejection);
      expect(h.state.palmRejection).toBe(true);
      API.executeAction(actionTogglePalmRejection);
      expect(h.state.palmRejection).toBe(false);

      API.executeAction(actionTogglePalmRejectionPinch);
      expect(h.state.palmRejectionPinch).toBe(false);
      API.executeAction(actionTogglePalmRejectionPinch);
      expect(h.state.palmRejectionPinch).toBe(true);

      API.executeAction(actionTogglePalmRejectionContactSize);
      expect(h.state.palmRejectionContactSize).toBe(true);
      API.executeAction(actionTogglePalmRejectionContactSize);
      expect(h.state.palmRejectionContactSize).toBe(false);
    });

    it("enabling it switches to tapered, pen-like strokes", () => {
      expect(h.state.currentItemStrokeVariability).toBe("constant");
      API.executeAction(actionTogglePalmRejection);
      expect(h.state.currentItemStrokeVariability).toBe("variable");
    });
  });

  describe("first touch wins", () => {
    beforeEach(() => {
      API.setAppState({ palmRejection: true });
      UI.clickTool("freedraw");
    });

    it("draws normally with a single touch", () => {
      down(STYLUS, 100, 100);
      move(STYLUS, 120, 110);
      move(STYLUS, 140, 130);
      up(STYLUS, 140, 130);

      expect(getFreedraws()).toHaveLength(1);
    });

    it("draws normally when the browser reports no contact size", () => {
      const noSize: Contact = { id: 1, primary: true };
      down(noSize, 100, 100);
      move(noSize, 120, 110);
      move(noSize, 140, 130);
      up(noSize, 140, 130);

      expect(getFreedraws()).toHaveLength(1);
    });

    it("keeps the stroke going while a palm rests and moves", () => {
      down(STYLUS, 100, 100);
      move(STYLUS, 120, 110);

      // palm lands far away from the stroke and keeps moving
      down(PALM, 400, 400);
      move(PALM, 410, 420);
      move(STYLUS, 140, 130);
      up(PALM, 410, 420);
      move(STYLUS, 160, 150);
      up(STYLUS, 160, 150);

      const freedraws = getFreedraws();
      expect(freedraws).toHaveLength(1);
      // the stroke only spans the stylus path, never reaching the palm
      expect(freedraws[0].x).toBeCloseTo(100, 0);
      expect(freedraws[0].width).toBeLessThan(100);
      expect(freedraws[0].height).toBeLessThan(100);
    });

    it("does not let additional fingers take over the stroke", () => {
      down(STYLUS, 100, 100);
      down({ id: 2 }, 300, 300);
      down({ id: 3 }, 320, 320);
      move({ id: 2 }, 330, 330);
      move({ id: 3 }, 340, 340);
      move(STYLUS, 130, 120);
      move(STYLUS, 160, 140);
      up({ id: 2 }, 330, 330);
      up({ id: 3 }, 340, 340);
      up(STYLUS, 160, 140);

      const freedraws = getFreedraws();
      expect(freedraws).toHaveLength(1);
      expect(freedraws[0].width).toBeLessThan(100);
    });

    it("lets the stylus draw again while the palm is still resting", () => {
      down(STYLUS, 100, 100);
      move(STYLUS, 110, 105);
      move(STYLUS, 120, 112);
      down(PALM, 400, 400);
      move(STYLUS, 130, 120);
      up(STYLUS, 130, 120);

      const nextStylus: Contact = { id: 3, size: 20 };
      down(nextStylus, 200, 100);
      move(nextStylus, 230, 120);
      move(nextStylus, 260, 140);
      up(nextStylus, 260, 140);
      up(PALM, 400, 400);

      const freedraws = getFreedraws();
      expect(freedraws).toHaveLength(2);
      expect(freedraws.every((element) => element.width < 100)).toBe(true);
    });

    it("recovers after the active pointer is cancelled", () => {
      down(STYLUS, 100, 100);
      move(STYLUS, 120, 110);
      fireEvent.pointerCancel(canvas(), eventInit(STYLUS, 120, 110));

      // a fresh stroke can start right away: nothing is stuck
      const next: Contact = { id: 3, primary: true, size: 20 };
      down(next, 300, 300);
      move(next, 320, 310);
      move(next, 340, 330);
      up(next, 340, 330);

      const last = getFreedraws().at(-1)!;
      expect(last.x).toBeCloseTo(300, 0);
    });

    it("does not affect mouse input while a palm is being ignored", () => {
      down(STYLUS, 100, 100);
      down(PALM, 400, 400); // ignored
      move(STYLUS, 120, 110);
      move(STYLUS, 140, 130);
      up(STYLUS, 140, 130);
      expect(getFreedraws()).toHaveLength(1);

      // the palm is still resting; the mouse must work as usual
      UI.createElement("freedraw", { x: 250, y: 250 });
      expect(getFreedraws()).toHaveLength(2);
    });
  });

  describe("contact size hint", () => {
    beforeEach(() => {
      API.setAppState({ palmRejection: true, palmRejectionContactSize: true });
      UI.clickTool("freedraw");
    });

    it("ignores a large palm even when it lands before the stylus", () => {
      const palm: Contact = { id: 1, primary: true, size: 90 };
      down(palm, 400, 400);
      move(palm, 410, 410);

      const stylus: Contact = { id: 2, size: 20 };
      down(stylus, 100, 100);
      move(stylus, 120, 110);
      move(stylus, 140, 130);
      up(stylus, 140, 130);
      up(palm, 410, 410);

      const freedraws = getFreedraws();
      expect(freedraws).toHaveLength(1);
      expect(freedraws[0].x).toBeCloseTo(100, 0);
      expect(freedraws[0].width).toBeLessThan(100);
    });

    it("does not reject anything when contact size is unavailable", () => {
      const noSize: Contact = { id: 1, primary: true };
      down(noSize, 100, 100);
      move(noSize, 120, 110);
      move(noSize, 140, 130);
      up(noSize, 140, 130);

      expect(getFreedraws()).toHaveLength(1);
    });
  });

  describe("two-finger pinch", () => {
    const FINGER_A: Contact = { id: 1, primary: true, size: 30 };
    const FINGER_B: Contact = { id: 2, size: 30 };

    /** both fingers land, then move apart (a deliberate pinch-out) */
    const spreadFingers = () => {
      down(FINGER_A, 200, 200);
      down(FINGER_B, 300, 200);
      move(FINGER_A, 180, 200);
      move(FINGER_B, 330, 200);
      move(FINGER_A, 120, 200);
      move(FINGER_B, 400, 200);
      move(FINGER_A, 60, 200);
      move(FINGER_B, 460, 200);
      up(FINGER_B, 460, 200);
      up(FINGER_A, 60, 200);
    };

    it("zooms when allowed", () => {
      API.setAppState({ palmRejection: true, palmRejectionPinch: true });
      const before = h.state.zoom.value;
      spreadFingers();
      expect(h.state.zoom.value).toBeGreaterThan(before);
    });

    it("works however far apart the fingers land", () => {
      API.setAppState({ palmRejection: true, palmRejectionPinch: true });
      const before = h.state.zoom.value;
      down(FINGER_A, 100, 100);
      down(FINGER_B, 700, 500);
      move(FINGER_A, 60, 70);
      move(FINGER_B, 740, 530);
      move(FINGER_A, 20, 40);
      move(FINGER_B, 780, 560);
      up(FINGER_B, 780, 560);
      up(FINGER_A, 20, 40);
      expect(h.state.zoom.value).toBeGreaterThan(before);
    });

    it("leaves no stray line behind with the freehand tool", () => {
      API.setAppState({ palmRejection: true, palmRejectionPinch: true });
      UI.clickTool("freedraw");
      const before = h.state.zoom.value;
      spreadFingers();
      expect(getFreedraws()).toHaveLength(0);
      expect(h.state.zoom.value).toBeGreaterThan(before);
    });

    it("does not zoom when pinch is switched off", () => {
      API.setAppState({ palmRejection: true, palmRejectionPinch: false });
      const before = h.state.zoom.value;
      spreadFingers();
      expect(h.state.zoom.value).toBe(before);
    });

    it("a hand landing with the stylus neither zooms nor cancels the stroke", () => {
      API.setAppState({ palmRejection: true, palmRejectionPinch: true });
      UI.clickTool("freedraw");
      const before = h.state.zoom.value;

      const hand: Contact = { id: 2, size: 30 };
      down(STYLUS, 100, 100);
      down(hand, 180, 160);
      // the hand drags along with the stylus (same direction)
      move(STYLUS, 160, 110);
      move(hand, 200, 170);
      move(STYLUS, 220, 130);
      move(hand, 260, 190);
      move(STYLUS, 280, 150);
      up(hand, 260, 190);
      up(STYLUS, 280, 150);

      expect(h.state.zoom.value).toBe(before);
      const freedraws = getFreedraws();
      expect(freedraws).toHaveLength(1);
      expect(freedraws[0].x).toBeCloseTo(100, 0);
    });

    it("a hand that rests while the stylus draws never zooms", () => {
      API.setAppState({ palmRejection: true, palmRejectionPinch: true });
      UI.clickTool("freedraw");
      const before = h.state.zoom.value;

      const hand: Contact = { id: 2, size: 30 };
      down(STYLUS, 100, 100);
      down(hand, 300, 300);
      move(STYLUS, 140, 120);
      move(STYLUS, 180, 140);
      move(STYLUS, 220, 160);
      move(hand, 302, 303);
      up(hand, 302, 303);
      up(STYLUS, 220, 160);

      expect(h.state.zoom.value).toBe(before);
      expect(getFreedraws()).toHaveLength(1);
    });
  });

  describe("accidental gestures", () => {
    it("suppresses the long-press context menu from a resting palm", () => {
      API.setAppState({ palmRejection: true });
      down(STYLUS, 100, 100);
      down(PALM, 400, 400);

      fireEvent.contextMenu(canvas(), {
        button: 2,
        clientX: 400,
        clientY: 400,
      });
      expect(h.state.contextMenu).toBe(null);

      // sanity check: once everything lifted, the menu works again
      up(PALM, 400, 400);
      up(STYLUS, 100, 100);
      fireEvent.contextMenu(canvas(), { button: 2, clientX: 1, clientY: 1 });
      expect(h.state.contextMenu).not.toBe(null);
    });

    describe("two-touch selection clearing", () => {
      // Excalidraw's double-tap detection is module-level state that expires
      // after TAP_TWICE_TIMEOUT; let a previous test's timer run out
      beforeEach(async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, TAP_TWICE_TIMEOUT + 50),
        );
      });

      const select = () => {
        const rect = API.createElement({
          type: "rectangle",
          x: 10,
          y: 10,
          width: 50,
          height: 50,
        });
        API.setElements([rect]);
        API.setSelectedElements([rect]);
        expect(Object.keys(h.state.selectedElementIds)).toHaveLength(1);
      };

      /**
       * the first touchstart only arms Excalidraw's double-tap detection and
       * returns early, so prime it before the two-finger touch
       */
      const twoFingerTouchStart = () => {
        dispatchTouchEvent("touchstart", 1);
        dispatchTouchEvent("touchstart", 2);
      };

      it("is unchanged when palm rejection is off", () => {
        select();
        twoFingerTouchStart();
        expect(Object.keys(h.state.selectedElementIds)).toHaveLength(0);
      });

      it("a resting palm no longer deselects when it is on", () => {
        API.setAppState({ palmRejection: true });
        select();
        twoFingerTouchStart();
        expect(Object.keys(h.state.selectedElementIds)).toHaveLength(1);
      });
    });
  });
});
