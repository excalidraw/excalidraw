/**
 * Framework-agnostic autosave queue.
 *
 *   editor change ─▶ update() ─▶ local draft (IndexedDB) ─▶ debounce ─▶ save()
 *
 * Guarantees:
 *  - never more than one request in flight
 *  - local draft is written BEFORE the network and only cleared after the
 *    server confirmed exactly that content, so a crash/offline never loses work
 *  - optimistic-concurrency conflicts are merged, then retried
 *  - network failures retry with exponential backoff and on `retryNow()`
 */

export type SaveState =
  | "idle" // nothing to save
  | "dirty" // waiting for debounce
  | "saving"
  | "saved"
  | "offline" // network failure, will retry
  | "error"; // permanent failure (permissions, size…)

export interface Snapshot {
  elements: readonly any[];
  appState: Record<string, any>;
}

export type SaveOutcome =
  | { kind: "ok"; version: number }
  | { kind: "conflict"; version: number; data: Snapshot };

export class SaveFailure extends Error {
  constructor(public retryable: boolean, message: string) {
    super(message);
  }
}

export interface Draft {
  baseVersion: number;
  snapshot: Snapshot;
  savedAt: number;
}

export interface DraftStore {
  get(): Promise<Draft | undefined>;
  set(draft: Draft): Promise<void>;
  clear(): Promise<void>;
}

export interface EngineOptions {
  baseVersion: number;
  save: (snapshot: Snapshot, baseVersion: number) => Promise<SaveOutcome>;
  /** Merge server content into local content; the result is what we retry with. */
  merge: (local: Snapshot, remote: Snapshot) => Snapshot;
  /** Called when a merge replaced local content and the editor must reflect it. */
  onMerged?: (merged: Snapshot) => void;
  drafts?: DraftStore;
  debounceMs?: number;
  maxWaitMs?: number;
  maxBackoffMs?: number;
  onState?: (s: SaveState, detail?: string) => void;
  onSaved?: (version: number) => void;
}

export class AutosaveEngine {
  state: SaveState = "idle";
  baseVersion: number;
  private snapshot: Snapshot | null = null;
  private token: unknown = undefined;
  private savedToken: unknown = undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private firstDirtyAt = 0;
  private inFlight: Promise<void> | null = null;
  private failures = 0;
  private disposed = false;
  private suspended = false;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  private debounceMs: number;
  private maxWaitMs: number;
  private maxBackoffMs: number;

  constructor(private o: EngineOptions) {
    this.baseVersion = o.baseVersion;
    this.debounceMs = o.debounceMs ?? 1500;
    this.maxWaitMs = o.maxWaitMs ?? 10_000;
    this.maxBackoffMs = o.maxBackoffMs ?? 30_000;
  }

  get hasUnsavedChanges() {
    return this.snapshot !== null && this.token !== this.savedToken;
  }

  /** Unsaved work that only lives on this device (nothing else is persisting it). */
  get atRisk() {
    return this.hasUnsavedChanges && !this.suspended;
  }

  /**
   * While a live collaboration session persists the scene server-side, timer
   * driven HTTP saves pause (they'd only fight the room with 409s). Local drafts
   * keep being written; resuming schedules a save if anything is still unsaved.
   */
  setSuspended(value: boolean) {
    if (this.suspended === value) {
      return;
    }
    this.suspended = value;
    if (value) {
      for (const t of [this.timer, this.retryTimer]) {
        if (t) {
          clearTimeout(t);
        }
      }
      this.timer = this.retryTimer = null;
    } else if (this.hasUnsavedChanges && !this.disposed) {
      this.firstDirtyAt = this.firstDirtyAt || Date.now();
      this.schedule();
    }
  }

  private setState(s: SaveState, detail?: string) {
    this.state = s;
    this.o.onState?.(s, detail);
  }

  /**
   * Called on every editor onChange. `token` must change whenever content
   * changed (e.g. getSceneVersion(elements)); identical tokens are ignored so
   * pointer-move noise never triggers a save.
   */
  update(snapshot: Snapshot, token: unknown) {
    if (this.disposed) {
      return;
    }
    if (this.snapshot === null && this.savedToken === undefined) {
      // First call = the scene as loaded; not a user change.
      this.snapshot = snapshot;
      this.token = token;
      this.savedToken = token;
      return;
    }
    if (token === this.token) {
      return;
    }
    this.snapshot = snapshot;
    this.token = token;
    if (this.state !== "saving") {
      this.setState("dirty");
    }
    if (!this.firstDirtyAt) {
      this.firstDirtyAt = Date.now();
    }
    this.persistDraftSoon();
    this.schedule();
  }

  /** Marks content as already-persisted (e.g. after loading a server copy). */
  markClean(snapshot: Snapshot, token: unknown) {
    this.snapshot = snapshot;
    this.token = token;
    this.savedToken = token;
  }

  /** Adopts a recovered local draft as pending work. */
  adoptDraft(snapshot: Snapshot, token: unknown) {
    this.snapshot = snapshot;
    this.token = token;
    this.savedToken = undefined;
    this.firstDirtyAt = Date.now();
    this.setState("dirty");
    this.schedule();
  }

  private schedule() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const waited = Date.now() - this.firstDirtyAt;
    const delay = Math.max(
      0,
      Math.min(this.debounceMs, this.maxWaitMs - waited),
    );
    if (this.suspended) {
      return;
    }
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  private persistDraftSoon() {
    if (!this.o.drafts || this.draftTimer) {
      return;
    }
    // Cheap, frequent: keeps a crash from losing more than ~300ms of work.
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null;
      void this.writeDraft();
    }, 300);
  }

  private async writeDraft() {
    if (!this.o.drafts || !this.snapshot || !this.hasUnsavedChanges) {
      return;
    }
    try {
      await this.o.drafts.set({
        baseVersion: this.baseVersion,
        snapshot: this.snapshot,
        savedAt: Date.now(),
      });
    } catch {
      /* storage full/unavailable: server save is still attempted */
    }
  }

  /** Save now (Ctrl+S, leaving the page). Resolves when the queue is drained or failed. */
  async flush(): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.inFlight) {
      await this.inFlight;
      if (!this.hasUnsavedChanges || this.state === "error") {
        return;
      }
    }
    if (!this.hasUnsavedChanges || !this.snapshot) {
      return;
    }
    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  /** Network came back / user pressed “retry”. */
  retryNow() {
    if (this.state === "offline" || this.state === "error") {
      void this.flush();
    }
  }

  private async run() {
    // Loop so merged conflicts and edits made mid-request are saved too.
    for (
      let guard = 0;
      guard < 10 && this.hasUnsavedChanges && !this.disposed;
      guard++
    ) {
      const snapshot = this.snapshot!;
      const token = this.token;
      this.firstDirtyAt = 0;
      this.setState("saving");
      await this.writeDraft();
      try {
        const out = await this.o.save(snapshot, this.baseVersion);
        this.failures = 0;
        if (out.kind === "conflict") {
          const merged = this.o.merge(this.snapshot!, out.data);
          this.baseVersion = out.version;
          this.snapshot = merged;
          // The merge produced content the server doesn't have yet.
          this.token = { merged: true, at: Date.now() };
          this.savedToken = undefined;
          this.o.onMerged?.(merged);
          continue;
        }
        this.baseVersion = out.version;
        this.savedToken = token;
        this.o.onSaved?.(out.version);
        if (token === this.token) {
          await this.o.drafts?.clear().catch(() => {});
        }
      } catch (e) {
        if (e instanceof SaveFailure && !e.retryable) {
          this.setState("error", e.message);
          return;
        }
        this.failures++;
        this.setState("offline", (e as Error)?.message);
        const delay = Math.min(
          this.maxBackoffMs,
          2000 * 2 ** (this.failures - 1),
        );
        if (!this.suspended) {
          this.retryTimer = setTimeout(() => void this.flush(), delay);
        }
        return;
      }
    }
    if (this.hasUnsavedChanges) {
      this.setState("dirty");
      this.schedule();
    } else {
      this.setState("saved");
    }
  }

  /** StrictMode-safe lifecycle: dispose() on cleanup, revive() on (re)mount. */
  revive() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    for (const t of [this.timer, this.retryTimer, this.draftTimer]) {
      if (t) {
        clearTimeout(t);
      }
    }
  }
}
