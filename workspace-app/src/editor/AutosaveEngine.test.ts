import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutosaveEngine, SaveFailure } from "./AutosaveEngine";

import type {
  Draft,
  DraftStore,
  SaveOutcome,
  Snapshot,
} from "./AutosaveEngine";

const snap = (...ids: string[]): Snapshot => ({
  elements: ids.map((id) => ({ id })),
  appState: {},
});

const memoryDrafts = () => {
  let draft: Draft | undefined;
  const store: DraftStore & { peek: () => Draft | undefined } = {
    get: async () => draft,
    set: async (d) => {
      draft = d;
    },
    clear: async () => {
      draft = undefined;
    },
    peek: () => draft,
  };
  return store;
};

const setup = (
  over: Partial<ConstructorParameters<typeof AutosaveEngine>[0]> = {},
) => {
  const save = vi.fn(
    async (_s: Snapshot, base: number): Promise<SaveOutcome> => ({
      kind: "ok",
      version: base + 1,
    }),
  );
  const states: string[] = [];
  const drafts = memoryDrafts();
  const engine = new AutosaveEngine({
    baseVersion: 1,
    save,
    merge: (local, remote) => ({
      elements: [
        ...remote.elements,
        ...local.elements.filter(
          (l) => !remote.elements.some((r) => r.id === l.id),
        ),
      ],
      appState: {},
    }),
    drafts,
    onState: (s) => states.push(s),
    ...over,
  });
  engine.update(snap(), 0); // baseline (scene as loaded)
  return { engine, save, states, drafts };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AutosaveEngine", () => {
  it("does not save unchanged content (pointer noise)", async () => {
    const { engine, save } = setup();
    engine.update(snap(), 0);
    engine.update(snap(), 0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(engine.state).toBe("idle");
  });

  it("debounces bursts into one save and tracks the version", async () => {
    const { engine, save, states } = setup();
    for (let i = 1; i <= 20; i++) {
      engine.update(snap("a", `b${i}`), i);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![1]).toBe(1);
    expect(engine.baseVersion).toBe(2);
    expect(engine.state).toBe("saved");
    expect(states).toContain("saving");
  });

  it("max-wait forces a save during continuous editing", async () => {
    const { engine, save } = setup({ debounceMs: 1500, maxWaitMs: 4000 });
    for (let i = 1; i <= 60; i++) {
      engine.update(snap(`x${i}`), i);
      await vi.advanceTimersByTimeAsync(200); // never idle for 1.5s
    }
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("writes a local draft before the network and clears it after success", async () => {
    const { engine, drafts } = setup();
    engine.update(snap("a"), 1);
    await vi.advanceTimersByTimeAsync(400);
    expect(drafts.peek()?.snapshot.elements).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(drafts.peek()).toBeUndefined();
  });

  it("keeps the draft and retries with backoff when offline, then recovers", async () => {
    let failing = true;
    const { engine, save, drafts, states } = setup({
      save: vi.fn(async (_s, base) => {
        if (failing) {
          throw new SaveFailure(true, "network");
        }
        return { kind: "ok", version: base + 1 } as SaveOutcome;
      }),
    });
    void save;
    engine.update(snap("a"), 1);
    await vi.advanceTimersByTimeAsync(1600);
    expect(engine.state).toBe("offline");
    expect(drafts.peek()).toBeDefined(); // work is safe locally
    await vi.advanceTimersByTimeAsync(2100); // 1st retry fails
    expect(engine.state).toBe("offline");
    failing = false;
    await vi.advanceTimersByTimeAsync(4100); // 2nd retry (4s backoff) succeeds
    expect(engine.state).toBe("saved");
    expect(drafts.peek()).toBeUndefined();
    expect(states.filter((s) => s === "offline").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("retryNow() saves immediately after connectivity returns", async () => {
    let failing = true;
    const { engine } = setup({
      save: async (_s, base) => {
        if (failing) {
          throw new SaveFailure(true, "network");
        }
        return { kind: "ok", version: base + 1 };
      },
    });
    engine.update(snap("a"), 1);
    await vi.advanceTimersByTimeAsync(1600);
    expect(engine.state).toBe("offline");
    failing = false;
    engine.retryNow();
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.state).toBe("saved");
  });

  it("merges on conflict then retries against the new version", async () => {
    const calls: [number, string[]][] = [];
    const merged = vi.fn();
    const { engine } = setup({
      save: async (s, base) => {
        calls.push([base, s.elements.map((e) => e.id)]);
        if (base === 1) {
          return { kind: "conflict", version: 5, data: snap("remote") };
        }
        return { kind: "ok", version: base + 1 };
      },
      onMerged: merged,
    });
    engine.update(snap("local"), 1);
    await vi.advanceTimersByTimeAsync(1600);
    expect(calls).toEqual([
      [1, ["local"]],
      [5, ["remote", "local"]],
    ]);
    expect(merged).toHaveBeenCalledOnce();
    expect(engine.baseVersion).toBe(6);
    expect(engine.state).toBe("saved");
  });

  it("stops (no retry storm) on permanent errors", async () => {
    const save = vi.fn(async () => {
      throw new SaveFailure(false, "You no longer have access");
    });
    const { engine } = setup({ save });
    engine.update(snap("a"), 1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.state).toBe("error");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves edits made while a request is in flight", async () => {
    let release!: () => void;
    const seen: string[][] = [];
    const { engine } = setup({
      save: (s, base) =>
        new Promise<SaveOutcome>((resolve) => {
          seen.push(s.elements.map((e) => e.id));
          release = () => resolve({ kind: "ok", version: base + 1 });
        }),
    });
    engine.update(snap("a"), 1);
    await vi.advanceTimersByTimeAsync(1600); // request 1 in flight
    engine.update(snap("a", "b"), 2); // edit while saving
    release();
    await vi.advanceTimersByTimeAsync(1600);
    release();
    await vi.advanceTimersByTimeAsync(10);
    expect(seen).toEqual([["a"], ["a", "b"]]);
    expect(engine.hasUnsavedChanges).toBe(false);
  });

  it("flush() saves immediately (manual save)", async () => {
    const { engine, save } = setup();
    engine.update(snap("a"), 1);
    await engine.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(engine.state).toBe("saved");
  });

  it("adopts a recovered draft and saves it", async () => {
    const { engine, save } = setup();
    engine.adoptDraft(snap("recovered"), 99);
    await vi.advanceTimersByTimeAsync(1600);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]![0].elements[0]).toEqual({ id: "recovered" });
  });

  it("pauses timer-driven saves while suspended and resumes afterwards", async () => {
    const { engine, save } = setup();
    engine.setSuspended(true);
    engine.update(snap("a"), 1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(save).not.toHaveBeenCalled();
    expect(engine.hasUnsavedChanges).toBe(true);
    expect(engine.atRisk).toBe(false); // the live room has it
    engine.setSuspended(false);
    expect(engine.atRisk).toBe(true);
    await vi.advanceTimersByTimeAsync(1600);
    expect(save).toHaveBeenCalledOnce();
  });

  it("manual flush still saves while suspended", async () => {
    const { engine, save } = setup();
    engine.setSuspended(true);
    engine.update(snap("a"), 1);
    await engine.flush();
    expect(save).toHaveBeenCalledOnce();
  });
});
