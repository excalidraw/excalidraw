import { randomId } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  newElementWith,
  type ElementUpdate,
  type StoreDelta,
  type TxUndoOverride,
} from "@excalidraw/element";

import { shallowCopySceneElements } from "./diff";
import { TransactionLedger } from "./ledger";

import {
  type AppStateResolver,
  type AppStateResolverContext,
  type TransactionElementOfType,
  type TransactionElementUpdate,
  type TransactionStatus,
  type TransactionSummary,
} from "./types";
import { TxUndoOverridePlanner } from "./undoOverridePlanner";

import type { TransactionManager } from "./manager";
import type {
  AppClassProperties,
  AppState,
  ObservedAppState,
  SceneData,
} from "../types";

type CommitOptions = {
  resolveAppState?: AppStateResolver;
};

/**
 * A transaction that records mutations via `updateScene(NEVER)` and commits
 * a single synthetic durable history entry at the end.
 */
export class Transaction {
  public readonly id = `tx-${randomId()}`;

  private readonly app: AppClassProperties;
  private readonly manager: TransactionManager;
  private readonly ledger = new TransactionLedger();
  private readonly undoOverridePlanner = new TxUndoOverridePlanner();
  private readonly initialAppState: Partial<ObservedAppState>;

  private accumulatedAppState: Record<string, unknown> = {};
  private cachedSummary: TransactionSummary | null = null;

  constructor(app: AppClassProperties, manager: TransactionManager) {
    this.app = app;
    this.manager = manager;
    this.initialAppState = { ...app.store.snapshot.appState };
    this.manager.registerTransaction(this);
  }

  get status(): TransactionStatus {
    return this.manager.getStatus(this.id);
  }

  private assertActive(action: string): void {
    const status = this.status;
    if (status !== "active") {
      throw new Error(
        `Cannot ${action} — transaction ${this.id} is already ${status}.`,
      );
    }
  }

  private closeTransaction() {
    this.manager.detachTransactionInstance(this.id);
    this.undoOverridePlanner.clear();
  }

  public collectUndoOverridesForDelta(
    delta: StoreDelta,
    reservedConsumedKeys: Set<string>,
  ): TxUndoOverride[] {
    if (this.status !== "active") {
      return [];
    }

    const candidates =
      this.undoOverridePlanner.collectCandidatesForDurableDelta(
        delta,
        (elementId) => this.ledger.getEntry(elementId),
        reservedConsumedKeys,
      );

    if (candidates.length === 0) {
      return [];
    }

    const overrides: TxUndoOverride[] = [];
    for (const candidate of candidates) {
      this.undoOverridePlanner.markConsumed(candidate.consumedKey);
      overrides.push({
        txId: this.id,
        ...candidate,
      });
    }

    return overrides;
  }

  updateScene<K extends keyof AppState>(data: {
    elements?: SceneData["elements"];
    appState?: Pick<AppState, K> | null;
  }): void {
    this.assertActive("updateScene");

    // Snapshot before (shallow copy — replaceAllElements mutates the map in-place)
    const before = shallowCopySceneElements(
      this.app.scene.getElementsMapIncludingDeleted(),
    );

    // Apply through the real updateScene with NEVER.
    this.app.api.updateScene({
      elements: data.elements,
      appState: data.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    // Snapshot after
    const after = this.app.scene.getElementsMapIncludingDeleted();

    this.undoOverridePlanner.recordStep(before, after);

    // Record element diff into ledger
    this.ledger.recordStep(before, after);

    // Accumulate appState intent
    if (data.appState) {
      this.accumulatedAppState = {
        ...this.accumulatedAppState,
        ...(data.appState as Record<string, unknown>),
      };
    }
  }

  /**
   * Partial element updates convenience API.
   *
   * Example:
   * tx.updateElements({
   *   elements: [
   *     { id: "a", type: "rectangle", updates: { strokeColor: "#f00" } },
   *     { id: "b", type: "rectangle", updates: { x: 10, y: 20 } },
   *   ],
   * })
   */
  updateElements<K extends keyof AppState>(data: {
    elements: readonly TransactionElementUpdate[];
    appState?: Pick<AppState, K> | null;
  }): void {
    const updatesById = new Map<string, TransactionElementUpdate>();

    for (const update of data.elements) {
      updatesById.set(update.id, update);
    }

    if (updatesById.size === 0) {
      this.updateScene({ appState: data.appState });
      return;
    }

    const nextElements = this.app.scene
      .getElementsIncludingDeleted()
      .map((element) => {
        const update = updatesById.get(element.id);
        if (!update) {
          return element;
        }
        if (element.type !== update.type) {
          throw new Error(
            `Cannot apply tx.updateElements update for "${update.id}": expected "${update.type}", got "${element.type}".`,
          );
        }

        type MatchingElement = TransactionElementOfType<typeof update.type>;
        return newElementWith(
          element as MatchingElement,
          update.updates as ElementUpdate<MatchingElement>,
        );
      });

    this.updateScene({
      elements: nextElements,
      appState: data.appState,
    });
  }

  commit(options?: CommitOptions): TransactionSummary {
    if (this.cachedSummary) {
      return this.cachedSummary;
    }

    this.manager.markTransactionCommitted(this.id);
    let historyCommitted = false;
    try {
      historyCommitted = this.hasPendingWork()
        ? this.commitHistoryEntry(options)
        : false;
    } finally {
      this.closeTransaction();
    }

    const status = this.status;
    this.cachedSummary = {
      id: this.id,
      status,
      historyCommitted,
    };
    this.ledger.clear();
    return this.cachedSummary;
  }

  private hasPendingWork() {
    return this.ledger.hasEntries() || this.hasAccumulatedAppStateIntent();
  }

  private hasAccumulatedAppStateIntent() {
    return Object.keys(this.accumulatedAppState).length > 0;
  }

  private commitHistoryEntry(options?: CommitOptions) {
    const liveMap = this.app.scene.getElementsMapIncludingDeleted();
    const { elementsBefore, elementsAfter } =
      this.ledger.buildSyntheticSnapshots(liveMap);

    const appStateDelta = this.resolveCommitAppStateDelta(options);

    return this.app.store.commitSyntheticIncrement({
      logicalBefore: { elements: elementsBefore },
      logicalAfter: {
        elements: elementsAfter,
        appState: appStateDelta,
      },
    });
  }

  private resolveCommitAppStateDelta(
    options?: CommitOptions,
  ): Partial<ObservedAppState> | undefined {
    if (!this.hasAccumulatedAppStateIntent()) {
      return undefined;
    }

    if (!options?.resolveAppState) {
      return this.accumulatedAppState as Partial<ObservedAppState>;
    }

    const context: AppStateResolverContext = {
      initial: this.initialAppState,
      accumulated: this.accumulatedAppState as Partial<ObservedAppState>,
      live: { ...this.app.store.snapshot.appState },
    };
    const resolved = options.resolveAppState(context);

    if (!resolved || Object.keys(resolved).length === 0) {
      return undefined;
    }
    return resolved;
  }

  cancel(): TransactionSummary {
    if (this.cachedSummary) {
      return this.cachedSummary;
    }

    if (this.status === "active") {
      this.manager.markTransactionCanceled(this.id);
    }

    this.closeTransaction();
    const status = this.status;
    this.cachedSummary = {
      id: this.id,
      status,
      historyCommitted: false,
    };
    this.ledger.clear();
    return this.cachedSummary;
  }
}
