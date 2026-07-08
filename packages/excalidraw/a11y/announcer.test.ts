import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announce, destroyLiveRegions, ensureLiveRegions } from "./announcer";

const getRegion = (politeness: "polite" | "assertive") =>
  document.querySelector<HTMLDivElement>(
    `#excalidraw-a11y-announcer [aria-live="${politeness}"]`,
  );

describe("a11y announcer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureLiveRegions();
  });

  afterEach(() => {
    destroyLiveRegions();
    vi.useRealTimers();
  });

  it("creates one hidden container with polite & assertive regions", () => {
    expect(getRegion("polite")).not.toBeNull();
    expect(getRegion("assertive")).not.toBeNull();
    expect(getRegion("polite")!.getAttribute("role")).toBe("status");
    expect(getRegion("assertive")!.getAttribute("role")).toBe("alert");
    // idempotent
    ensureLiveRegions();
    expect(document.querySelectorAll("#excalidraw-a11y-announcer").length).toBe(
      1,
    );
    destroyLiveRegions();
  });

  it("writes polite messages immediately and clears them later", () => {
    announce("Rectangle tool");
    expect(getRegion("polite")!.textContent).toBe("Rectangle tool");
    vi.advanceTimersByTime(1100);
    expect(getRegion("polite")!.textContent).toBe("");
  });

  it("routes assertive messages and drops pending polite text", () => {
    announce("moved");
    announce("Canvas cleared", { politeness: "assertive" });
    expect(getRegion("polite")!.textContent).toBe("");
    expect(getRegion("assertive")!.textContent).toBe("Canvas cleared");
  });

  it("coalesces bursts sharing a key to the last message", () => {
    announce("Moved 10 px", { coalesceKey: "move" });
    announce("Moved 20 px", { coalesceKey: "move" });
    announce("Moved 30 px", { coalesceKey: "move" });
    expect(getRegion("polite")!.textContent).toBe("");
    vi.advanceTimersByTime(300);
    expect(getRegion("polite")!.textContent).toBe("Moved 30 px");
  });

  it("does not coalesce across different keys", () => {
    announce("Moved 10 px", { coalesceKey: "move" });
    announce("Zoom 120%", { coalesceKey: "zoom" });
    vi.advanceTimersByTime(300);
    // last write wins in the region, but both fired
    expect(getRegion("polite")!.textContent).toBe("Zoom 120%");
  });

  it("is a no-op after destroy", () => {
    destroyLiveRegions();
    expect(document.getElementById("excalidraw-a11y-announcer")).toBeNull();
    expect(() => announce("orphan")).not.toThrow();
    // restore for afterEach symmetry
    ensureLiveRegions();
  });
});
