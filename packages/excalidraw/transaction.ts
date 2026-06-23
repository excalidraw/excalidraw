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
import type App from "./components/App";

type TransactionStatus = "active" | "committed" | "rolled-back";

export interface TransactionUpdate {
  elements?: SceneElementsMap;
  appState?: AppState | ObservedAppState;
}

interface RollbackState {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
}

export class Transaction {
  readonly id: string = randomId();
  private _status: TransactionStatus = "active";

  readonly originalElementStates = new Map<
    string,
    OrderedExcalidrawElement | null
  >();
  private readonly touchedAppStateKeys = new Set<string>();
  private readonly originalAppState: Record<string, unknown> = {};
  private prevSnapshot: StoreSnapshot;

  constructor(
    private readonly app: App,
    private readonly rollbackState: RollbackState,
    private readonly onDone: () => void,
  ) {
    // Freeze the baseline by deep-copying elements. The scene mutates elements in
    // place (mutateElement), so without copying, these references would mutate to
    // their final state and commit() would compute an empty delta.
    const baselineElements = new Map() as SceneElementsMap;
    for (const element of this.app.scene
      .getElementsMapIncludingDeleted()
      .values()) {
      baselineElements.set(element.id, deepCopyElement(element));
    }
    this.prevSnapshot = StoreSnapshot.create(baselineElements, this.app.state);
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
    const currentSnapshot = StoreSnapshot.create(
      this.app.scene.getElementsMapIncludingDeleted(),
      this.app.state,
    );

    for (const [elementId, originalState] of this.originalElementStates) {
      if (originalState !== null) {
        prevElements.set(elementId, originalState);
      }
      const current = currentSnapshot.elements.get(elementId);
      if (current) {
        nextElements.set(elementId, deepCopyElement(current));
      }
    }

    // ── Build appState pseudo-snapshots (only touched fields) ─────────────
    const prevAppState = { ...currentSnapshot.appState };
    for (const key of this.touchedAppStateKeys) {
      (prevAppState as Record<string, unknown>)[key] =
        this.originalAppState[key];
    }
    const nextAppState = currentSnapshot.appState;

    const elementsDelta = ElementsDelta.calculate(prevElements, nextElements);
    const appStateDelta = AppStateDelta.calculate(prevAppState, nextAppState);
    const storeDelta = StoreDelta.create(elementsDelta, appStateDelta);

    if (!storeDelta.isEmpty()) {
      this.app.history.record(storeDelta);
    }

    // Keep the store snapshot in sync with the committed scene, mirroring the
    // store's durable-increment flow. Undo/redo re-base their inverse deltas
    // against `store.snapshot`; if it stayed stale the redo entry would be
    // computed from the wrong baseline and redo would not restore the change.
    this.app.store.snapshot = this.app.store.snapshot.maybeClone(
      CaptureUpdateAction.IMMEDIATELY,
      this.app.scene.getElementsMapIncludingDeleted(),
      this.app.state,
    );

    this._status = "committed";
    this.onDone();
  }

  /**
   * Revert: restore scene to begin()-state and reset store snapshot directly.
   * No history entry. Synchronous — no render cycle required for snapshot reset.
   */
  rollback(): void {
    this.assertActive();

    this.app.updateScene({
      elements: this.rollbackState.elements,
      appState: this.rollbackState.appState,
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
  private defaultTxn: Transaction;

  constructor(private readonly app: App) {
    this.defaultTxn = this.createDefault();
  }

  /** The always-active default transaction. Auto-restarts after commit or rollback. */
  get default(): Transaction {
    return this.defaultTxn;
  }

  /** Open a new keyed transaction. Throws if a transaction with that key is already active. */
  begin(key: string): Transaction {
    if (this.keyed.has(key)) {
      throw new Error(`Transaction "${key}" is already active.`);
    }
    const txn = new Transaction(this.app, this.captureRollbackState(), () =>
      this.keyed.delete(key),
    );
    this.keyed.set(key, txn);
    return txn;
  }

  get(key: string): Transaction | undefined {
    return this.keyed.get(key);
  }

  /** Rollback all keyed transactions and the default transaction (default auto-restarts). */
  rollbackAll(): void {
    for (const txn of this.keyed.values()) {
      txn.rollback();
    }
    this.defaultTxn.rollback();
  }

  createDefault(): Transaction {
    this.defaultTxn = new Transaction(
      this.app,
      this.captureRollbackState(),
      () => {
        this.defaultTxn = this.createDefault();
      },
    );
    return this.defaultTxn;
  }

  private captureRollbackState(): RollbackState {
    return {
      elements: this.app.scene.getElementsIncludingDeleted(),
      appState: this.app.state,
    };
  }
}
