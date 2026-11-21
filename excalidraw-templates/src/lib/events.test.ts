import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsoleSink,
  LocalStorageSink,
  markStripShown,
  setSinks,
  track,
  type AnalyticsEvent,
  type Sink,
} from "./events";

// vitest's default environment is Node — there's no `window`/`localStorage`.
// LocalStorageSink only ever touches `window.localStorage`, so a minimal
// in-memory Storage stub is enough; no jsdom/happy-dom dependency needed.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function installFakeWindow() {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: new MemoryStorage(),
  };
}

function removeWindow() {
  delete (globalThis as { window?: unknown }).window;
}

describe("ConsoleSink", () => {
  it("logs the event name and payload", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const sink = new ConsoleSink();
    const event: AnalyticsEvent = {
      name: "template_selected",
      templateId: "flowchart",
      msSinceStripShown: 42,
      timestamp: 123,
      props: {},
    };
    sink.emit(event);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("template_selected"),
      event,
    );
    spy.mockRestore();
  });
});

describe("LocalStorageSink", () => {
  beforeEach(() => {
    installFakeWindow();
    LocalStorageSink.clear();
  });

  afterEach(() => {
    removeWindow();
  });

  it("starts empty", () => {
    expect(LocalStorageSink.readAll()).toEqual([]);
  });

  it("appends emitted events and readAll reflects them", () => {
    const sink = new LocalStorageSink();
    const event: AnalyticsEvent = {
      name: "diagram_inserted",
      templateId: "org",
      msSinceStripShown: 10,
      timestamp: 1,
      props: { source: "ai" },
    };
    sink.emit(event);
    expect(LocalStorageSink.readAll()).toEqual([event]);
  });

  it("caps the ring buffer, dropping the oldest events", () => {
    const sink = new LocalStorageSink();
    for (let i = 0; i < 210; i++) {
      sink.emit({
        name: "diagram_inserted",
        templateId: "flowchart",
        msSinceStripShown: i,
        timestamp: i,
        props: {},
      });
    }
    const all = LocalStorageSink.readAll();
    expect(all.length).toBe(200);
    // oldest 10 (msSinceStripShown 0..9) should have been dropped
    expect(all[0].msSinceStripShown).toBe(10);
    expect(all[all.length - 1].msSinceStripShown).toBe(209);
  });

  it("clear empties the buffer", () => {
    const sink = new LocalStorageSink();
    sink.emit({
      name: "diagram_inserted",
      templateId: "flowchart",
      msSinceStripShown: 0,
      timestamp: 0,
      props: {},
    });
    expect(LocalStorageSink.readAll()).toHaveLength(1);
    LocalStorageSink.clear();
    expect(LocalStorageSink.readAll()).toEqual([]);
  });

  it("drops silently instead of throwing when localStorage is unavailable", () => {
    removeWindow();
    const sink = new LocalStorageSink();
    expect(() =>
      sink.emit({
        name: "diagram_inserted",
        templateId: "flowchart",
        msSinceStripShown: 0,
        timestamp: 0,
        props: {},
      }),
    ).not.toThrow();
    expect(() => LocalStorageSink.readAll()).not.toThrow();
    expect(LocalStorageSink.readAll()).toEqual([]);
  });
});

describe("track / markStripShown", () => {
  let events: AnalyticsEvent[];
  let mockSink: Sink;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    events = [];
    mockSink = { emit: (e) => events.push(e) };
    setSinks([mockSink]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports msSinceStripShown as null before the strip has ever shown", () => {
    track("diagram_inserted", { templateId: "flowchart" });
    expect(events[0].msSinceStripShown).toBeNull();
  });

  it("computes elapsed time relative to the last markStripShown call", () => {
    markStripShown();
    vi.setSystemTime(1500);
    track("template_selected", { templateId: "flowchart" });

    const selected = events.find((e) => e.name === "template_selected");
    expect(selected?.msSinceStripShown).toBe(1500);
  });

  it("resets the baseline on a second markStripShown call", () => {
    markStripShown();
    vi.setSystemTime(5000);
    markStripShown();
    vi.setSystemTime(5200);
    track("template_selected", { templateId: "flowchart" });

    const selected = events.find(
      (e) => e.name === "template_selected" && e.timestamp === 5200,
    );
    expect(selected?.msSinceStripShown).toBe(200);
  });

  it("splits templateId out of props onto its own field", () => {
    track("prompt_submitted", { templateId: "mindmap", promptLength: 12 });
    expect(events[0].templateId).toBe("mindmap");
    expect(events[0].props).toEqual({ promptLength: 12 });
  });

  it("fans out to every configured sink", () => {
    const second: AnalyticsEvent[] = [];
    setSinks([mockSink, { emit: (e) => second.push(e) }]);
    track("diagram_inserted", { templateId: "flowchart" });
    expect(events).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});
