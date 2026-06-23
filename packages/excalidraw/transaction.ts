import { randomId } from "@excalidraw/common";
import {
  AppStateDelta,
  CaptureUpdateAction,
  deepCopyElement,
  ElementsDelta,
  StoreDelta,
  StoreSnapshot,
} from "@excalidraw/element";

import type {
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import type { AppState, ObservedAppState } from "./types";

type TransactionStatus = "active" | "committed" | "rolled-back";

export interface TransactionUpdate {
  elements?: SceneElementsMap;
  appState?: AppState | ObservedAppState;
}

/**
 * The narrow set of editor capabilities the transaction system needs.
 *
 * Injecting this (instead of the whole `App`) keeps the system decoupled and
 * testable, and lets the host keep its `store`/`history` private — they are
 * reached only through these closures.
 */
export interface TransactionContext {
  /** Current scene elements, including deleted. */
  getElementsMap: () => SceneElementsMap;
  /** Current app state. */
  getAppState: () => AppState;
  /** Current store snapshot. */
  getSnapshot: () => StoreSnapshot;
  /** Replace the store snapshot (used to keep it in sync on commit). */
  setSnapshot: (snapshot: StoreSnapshot) => void;
  /** Push a durable delta onto the undo stack. */
  recordHistory: (delta: StoreDelta) => void;
  /** Apply elements/appState back to the scene (used by rollback). */
  applyUpdate: (data: {
    elements: readonly OrderedExcalidrawElement[];
    appState: AppState;
  }) => void;
}

export class Transaction {
  readonly id: string = randomId();
  private _status: TransactionStatus = "active";

  private readonly originalElementStates = new Map<
    string,
    OrderedExcalidrawElement | null
  >();
  private readonly touchedAppStateKeys = new Set<string>();
  private readonly originalAppState: Record<string, unknown> = {};
  private prevSnapshot: StoreSnapshot;

  constructor(
    private readonly context: TransactionContext,
    private readonly onDone: () => void,
  ) {
    // Freeze the baseline by deep-copying elements. The scene mutates elements in
    // place (mutateElement), so without copying, these references would mutate to
    // their final state and commit() would compute an empty delta.
    const baselineElements = new Map() as SceneElementsMap;
    for (const element of this.context.getElementsMap().values()) {
      baselineElements.set(element.id, deepCopyElement(element));
    }
    this.prevSnapshot = StoreSnapshot.create(
      baselineElements,
      this.context.getAppState(),
    );
  }

  get status(): TransactionStatus {
    return this._status;
  }

  /**
   * Register touched elements / appState keys, capturing their original (baseline)
   * state on first touch. No scene side-effect — the scene is mutated elsewhere.
   */
  update(changes: TransactionUpdate): void {
    this.assertActive();

    if (changes.elements) {
      for (const el of changes.elements.values()) {
        const id = el.id;
        if (!this.originalElementStates.has(id)) {
          this.originalElementStates.set(
            id,
            this.prevSnapshot.elements.get(id) ?? null,
          );
        }
      }
    }

    if (changes.appState) {
      for (const key of Object.keys(changes.appState)) {
        if (!this.touchedAppStateKeys.has(key)) {
          this.touchedAppStateKeys.add(key);
          this.originalAppState[key] = (
            this.prevSnapshot.appState as Record<string, unknown>
          )[key];
        }
      }
    }
  }

  /**
   * Record a single consolidated history delta for everything touched since the
   * transaction began (frozen baseline vs. current scene). Transparent model: the
   * scene is already mutated through the normal flow, so commit() does not re-apply.
   */
  commit(): void {
    this.assertActive();

    // ── Build element-scoped pseudo-snapshots ──────────────────────────────
    const prevElements = new Map<
      string,
      OrderedExcalidrawElement
    >() as SceneElementsMap;
    const nextElements = new Map<
      string,
      OrderedExcalidrawElement
    >() as SceneElementsMap;
    const currentElements = this.context.getElementsMap();
    const currentAppState = this.context.getAppState();

    for (const [elementId, originalState] of this.originalElementStates) {
      if (originalState !== null) {
        prevElements.set(elementId, originalState);
      }
      const current = currentElements.get(elementId);
      if (current) {
        nextElements.set(elementId, deepCopyElement(current));
      }
    }

    // ── Build appState pseudo-snapshots (only touched fields) ─────────────
    const observedAppState = StoreSnapshot.create(
      currentElements,
      currentAppState,
    ).appState;
    const prevAppState = { ...observedAppState };
    for (const key of this.touchedAppStateKeys) {
      (prevAppState as Record<string, unknown>)[key] =
        this.originalAppState[key];
    }
    const nextAppState = observedAppState;

    const elementsDelta = ElementsDelta.calculate(prevElements, nextElements);
    const appStateDelta = AppStateDelta.calculate(prevAppState, nextAppState);
    const storeDelta = StoreDelta.create(elementsDelta, appStateDelta);

    if (!storeDelta.isEmpty()) {
      this.context.recordHistory(storeDelta);
    }

    // Keep the store snapshot in sync with the committed scene, mirroring the
    // store's durable-increment flow. Undo/redo re-base their inverse deltas
    // against the snapshot; if it stayed stale the redo entry would be computed
    // from the wrong baseline and redo would not restore the change.
    this.context.setSnapshot(
      this.context
        .getSnapshot()
        .maybeClone(
          CaptureUpdateAction.IMMEDIATELY,
          currentElements,
          currentAppState,
        ),
    );

    this._status = "committed";
    this.onDone();
  }

  /**
   * Revert the elements / appState keys this transaction registered via update()
   * back to their begin()-time baseline. No history entry.
   *
   * Scoped, not whole-scene: the revert is merged over the *current* scene, so work
   * committed by other concurrent transactions (added/removed/edited elements this
   * transaction never touched) is preserved. The baselines are the deep copies frozen
   * at begin() (`originalElementStates`), so in-place property mutations are reverted too.
   *
   * Shared-element conflict: if another transaction committed an element this one also
   * registered, rollback still reverts it to this transaction's baseline (clobbering the
   * committed value). That is an inherent write-write conflict — out of scope (the system
   * is not a CRDT conflict resolver).
   */
  rollback(): void {
    this.assertActive();

    // Start from the current scene so other transactions' committed work survives.
    const nextElements = new Map(
      this.context.getElementsMap(),
    ) as SceneElementsMap;

    for (const [id, originalState] of this.originalElementStates) {
      if (originalState === null) {
        // Didn't exist at begin() → this transaction added it → drop it.
        nextElements.delete(id);
      } else {
        // Restore the frozen baseline. Re-copy so the live scene can't alias and
        // mutate our baseline after rollback.
        nextElements.set(id, deepCopyElement(originalState));
      }
    }

    // Restore only the touched *observed* appState keys over the current appState.
    // Non-observed keys have no baseline (they are absent from the observed
    // snapshot) and must not be clobbered with `undefined`. This mirrors commit(),
    // which likewise operates purely in observed-appState space.
    const nextAppState = { ...this.context.getAppState() };
    for (const key of this.touchedAppStateKeys) {
      if (key in this.prevSnapshot.appState) {
        (nextAppState as Record<string, unknown>)[key] =
          this.originalAppState[key];
      }
    }

    this.context.applyUpdate({
      elements: Array.from(nextElements.values()),
      appState: nextAppState,
    });

    this._status = "rolled-back";
    this.onDone();
  }

  private assertActive(): void {
    if (this._status !== "active") {
      throw new Error(
        `Transaction "${this.id}" is already ${this._status} and cannot be used.`,
      );
    }
  }
}

export class TransactionManager {
  private keyed = new Map<string, Transaction>();
  /** The always-active default transaction. Auto-restarts after commit/rollback. */
  private defaultTxn!: Transaction;

  constructor(private readonly context: TransactionContext) {
    this.begin();
  }

  /**
   * Open a transaction. With no key, (re)starts the always-active default
   * transaction. With a key, opens a keyed transaction — throws if one with that
   * key is already active.
   */
  begin(key?: string): Transaction {
    if (key === undefined) {
      // the default transaction auto-restarts itself once it finishes
      this.defaultTxn = this.create(() => this.begin());
      return this.defaultTxn;
    }

    if (this.keyed.has(key)) {
      throw new Error(`Transaction "${key}" is already active.`);
    }
    const txn = this.create(() => this.keyed.delete(key));
    this.keyed.set(key, txn);
    return txn;
  }

  /**
   * Get a transaction. With no key, returns the default transaction; with a key,
   * returns the matching keyed transaction (or undefined).
   */
  get(): Transaction;
  get(key: string): Transaction | undefined;
  get(key?: string): Transaction | undefined {
    return this.resolve(key);
  }

  /** Commit the keyed transaction (or the default when no key is given). */
  commit(key?: string): void {
    this.resolve(key)?.commit();
  }

  /** Rollback the keyed transaction (or the default when no key is given). */
  rollback(key?: string): void {
    this.resolve(key)?.rollback();
  }

  /** Rollback all keyed transactions and the default transaction (default auto-restarts). */
  rollbackAll(): void {
    for (const txn of this.keyed.values()) {
      txn.rollback();
    }
    this.defaultTxn.rollback();
  }

  private create(onDone: () => void): Transaction {
    return new Transaction(this.context, onDone);
  }

  private resolve(key?: string): Transaction | undefined {
    return key === undefined ? this.defaultTxn : this.keyed.get(key);
  }
}
