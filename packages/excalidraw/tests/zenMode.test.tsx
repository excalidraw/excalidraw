import { vi } from "vitest";

import { ZEN_MODE_TRANSITION_DURATION } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

const getContainer = () =>
  document.querySelector<HTMLDivElement>(".excalidraw-container")!;

describe("zen mode", () => {
  describe("data-zen-mode-transition", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("flags the container while toggling, and unflags it once the transition is over", async () => {
      await render(<Excalidraw />);
      const container = getContainer();

      expect(container.hasAttribute("data-zen-mode-transition")).toBe(false);

      API.setAppState({ zenModeEnabled: true });
      expect(container.hasAttribute("data-zen-mode-transition")).toBe(true);

      // the attribute outlives the CSS transition slightly, so it isn't cut short
      act(() => {
        vi.advanceTimersByTime(ZEN_MODE_TRANSITION_DURATION);
      });
      expect(container.hasAttribute("data-zen-mode-transition")).toBe(true);

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(container.hasAttribute("data-zen-mode-transition")).toBe(false);
    });

    it("keeps the flag set across rapid toggles instead of unflagging mid-transition", async () => {
      await render(<Excalidraw />);
      const container = getContainer();

      API.setAppState({ zenModeEnabled: true });
      act(() => {
        vi.advanceTimersByTime(ZEN_MODE_TRANSITION_DURATION);
      });
      API.setAppState({ zenModeEnabled: false });

      // the first toggle's timer must not unflag the second one's transition
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(container.hasAttribute("data-zen-mode-transition")).toBe(true);

      act(() => {
        vi.advanceTimersByTime(ZEN_MODE_TRANSITION_DURATION);
      });
      expect(container.hasAttribute("data-zen-mode-transition")).toBe(false);
    });

    it("is not flagged by state changes other than zen mode", async () => {
      await render(<Excalidraw />);
      const container = getContainer();

      API.setAppState({ gridModeEnabled: true });
      expect(container.hasAttribute("data-zen-mode-transition")).toBe(false);
    });
  });

  describe("openMenu on view mode toggle", () => {
    it("stays open when entering view mode, since that's where it's toggled from", async () => {
      await render(<Excalidraw />);

      API.setAppState({ openMenu: "canvas" });
      API.setAppState({ viewModeEnabled: true });

      expect(h.state.viewModeEnabled).toBe(true);
      expect(h.state.openMenu).toBe("canvas");
    });

    it("closes when interaction gets disabled", async () => {
      const { rerender } = await render(<Excalidraw />);

      API.setAppState({ openMenu: "canvas" });

      await act(async () => {
        rerender(<Excalidraw interaction={false} />);
      });

      expect(h.state.openMenu).toBe(null);
    });
  });
});
