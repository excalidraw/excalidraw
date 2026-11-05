import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { AnimationController } from "../renderer/animation";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  render,
  waitFor,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

const { h } = window;

const waitForFrames = (frames = 5) => {
  return act(
    () =>
      new Promise<void>((resolve) => {
        let remaining = frames;
        const step = () => {
          if (--remaining <= 0) {
            resolve();
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      }),
  );
};

const waitForAnimationToStop = (maxFrames = 100) => {
  return act(
    () =>
      new Promise<void>((resolve) => {
        let remaining = maxFrames;
        const check = () => {
          if (!h.app.keyboardPan.isNavigating() || --remaining <= 0) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      }),
  );
};

describe("keyboard panning in view mode", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    window.EXCALIDRAW_THROTTLE_RENDER = true;
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
    API.setAppState({
      viewModeEnabled: true,
      scrollX: 0,
      scrollY: 0,
    });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    window.EXCALIDRAW_THROTTLE_RENDER = undefined;
    AnimationController.reset();
  });

  it("pans canvas left and right using arrow keys in view mode", async () => {
    expect(h.state.scrollX).toBe(0);

    // ArrowLeft moves camera left -> scene moves right (scrollX increases)
    Keyboard.keyDown(KEYS.ARROW_LEFT);
    await waitForFrames(4);
    Keyboard.keyUp(KEYS.ARROW_LEFT);

    const scrolledLeftX = h.state.scrollX;
    expect(scrolledLeftX).toBeGreaterThan(0);

    // ArrowRight moves camera right -> scene moves left (scrollX decreases)
    Keyboard.keyDown(KEYS.ARROW_RIGHT);
    await waitForFrames(8);
    Keyboard.keyUp(KEYS.ARROW_RIGHT);

    expect(h.state.scrollX).toBeLessThan(scrolledLeftX);
  });

  it("pans canvas up and down using arrow keys in view mode", async () => {
    expect(h.state.scrollY).toBe(0);

    // ArrowUp moves camera up -> scene moves down (scrollY increases)
    Keyboard.keyDown(KEYS.ARROW_UP);
    await waitForFrames(4);
    Keyboard.keyUp(KEYS.ARROW_UP);

    const scrolledUpY = h.state.scrollY;
    expect(scrolledUpY).toBeGreaterThan(0);

    // ArrowDown moves camera down -> scene moves up (scrollY decreases)
    Keyboard.keyDown(KEYS.ARROW_DOWN);
    await waitForFrames(8);
    Keyboard.keyUp(KEYS.ARROW_DOWN);

    expect(h.state.scrollY).toBeLessThan(scrolledUpY);
  });

  it("pans diagonally when holding two arrow keys simultaneously", async () => {
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    // Hold Up + Left simultaneously
    Keyboard.keyDown(KEYS.ARROW_UP);
    Keyboard.keyDown(KEYS.ARROW_LEFT);
    await waitForFrames(5);
    Keyboard.keyUp(KEYS.ARROW_UP);
    Keyboard.keyUp(KEYS.ARROW_LEFT);

    expect(h.state.scrollX).toBeGreaterThan(0);
    expect(h.state.scrollY).toBeGreaterThan(0);
  });

  it("decays smoothly after releasing arrow keys instead of stopping abruptly", async () => {
    Keyboard.keyDown(KEYS.ARROW_RIGHT);
    await waitForFrames(5);
    Keyboard.keyUp(KEYS.ARROW_RIGHT);

    const scrollXAtRelease = h.state.scrollX;
    expect(scrollXAtRelease).toBeLessThan(0);

    // During decay frames, the viewport should keep drifting further in the same direction
    await waitForFrames(3);
    expect(h.state.scrollX).toBeLessThan(scrollXAtRelease);

    // Wait until full stop
    await waitForAnimationToStop();
    expect(h.app.keyboardPan.isNavigating()).toBe(false);
  });

  it("moves faster when Shift key is held", async () => {
    API.setAppState({ scrollX: 0, scrollY: 0 });

    // Move without shift for 4 frames
    Keyboard.keyDown(KEYS.ARROW_LEFT);
    await waitForFrames(4);
    Keyboard.keyUp(KEYS.ARROW_LEFT);
    await waitForAnimationToStop();
    const normalDistance = h.state.scrollX;

    API.setAppState({ scrollX: 0, scrollY: 0 });

    // Move with shift for 4 frames
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyDown(KEYS.ARROW_LEFT);
    });
    await waitForFrames(4);
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyUp(KEYS.ARROW_LEFT);
    });
    await waitForAnimationToStop();
    const shiftDistance = h.state.scrollX;

    expect(shiftDistance).toBeGreaterThan(normalDistance);
  });

  it("does not pan canvas when not in view mode", async () => {
    API.setAppState({
      viewModeEnabled: false,
      scrollX: 0,
      scrollY: 0,
    });

    Keyboard.keyDown(KEYS.ARROW_LEFT);
    await waitForFrames(5);
    Keyboard.keyUp(KEYS.ARROW_LEFT);

    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
  });

  it("does not pan canvas when typing inside an input element", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    Keyboard.keyDown(KEYS.ARROW_LEFT, input);
    await waitForFrames(5);
    Keyboard.keyUp(KEYS.ARROW_LEFT, input);

    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    document.body.removeChild(input);
  });
});
