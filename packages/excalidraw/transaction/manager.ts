import {
  Delta,
  ElementsDelta,
  mergeStoreDeltaSemantics,
  type StoreDelta,
  type TxUndoOverride,
} from "@excalidraw/element";

import type { Mutable } from "@excalidraw/common/utility-types";

import {
  HistoryDelta,
  type HistoryBeforeRecordListener,
  type HistoryEffectiveDeltaResolverContext,
} from "../history";

import {
  type ElementUpdatedPropName,
  getUpdatedElementEntries,
  hasUpdatedElementEntries,
  isLedgerValueEqual,
  type ElementUpdatedProps,
  type ElementUpdatedEntryMap,
} from "./diff";
import { Transaction } from "./transaction";

import type { AppClassProperties } from "../types";
import type { TransactionStatus } from "./types";

type TransactionRecord = {
  tx: Transaction | null;
  phase: TransactionStatus;
};
type TransactionHistoryBridge = {
  onBeforeRecord: (callback: HistoryBeforeRecordListener) => () => void;
  setEffectiveDeltaResolver: (
    resolver:
      | ((
          delta: HistoryDelta,
          context: HistoryEffectiveDeltaResolverContext,
        ) => HistoryDelta)
      | null,
  ) => void;
};

type MutableElementUpdatedProps = Mutable<ElementUpdatedProps>;

const setElementUpdatedOverride = (
  overrides: MutableElementUpdatedProps,
  prop: ElementUpdatedPropName,
  value: unknown,
) => {
  (overrides as Record<ElementUpdatedPropName, unknown>)[prop] = value;
};

/**
 * Thin factory that holds the app reference and creates Transaction instances.
 */
export class TransactionManager {
  private readonly app: AppClassProperties;
  /**
   * Single authoritative lifecycle registry for transactions.
   *
   * We retain ended/canceled metadata after the tx object is released because
   * history semantics only persist `txId`; undo/redo still needs to resolve
   * whether a tx was active or already ended when applying effective deltas.
   */
  private readonly transactionRecords = new Map<string, TransactionRecord>();
  /**
   * Active transaction ids ordered by most-recent registration first.
   * This preserves deterministic priority when multiple active txs overlap on
   * the same element+prop and compete to reserve override markers.
   */
  private readonly activeTransactionIdsByPriority: string[] = [];
  private detachBeforeRecordHook: (() => void) | null = null;

  constructor(app: AppClassProperties) {
    this.app = app;
  }

  /**
   * Binds transaction bookkeeping to history lifecycle hooks.
   * Call once during app initialization.
   */
  attachHistory(history: TransactionHistoryBridge) {
    this.detachBeforeRecordHook?.();
    history.setEffectiveDeltaResolver((delta, context) =>
      this.resolveEffectiveDelta(delta, context),
    );
    this.detachBeforeRecordHook = history.onBeforeRecord((delta) =>
      this.onDurableIncrement(delta),
    );
  }

  private removeActiveTransactionId(txId: string) {
    const txIndex = this.activeTransactionIdsByPriority.indexOf(txId);
    if (txIndex >= 0) {
      this.activeTransactionIdsByPriority.splice(txIndex, 1);
    }
  }

  private getRequiredTransactionRecord(txId: string): TransactionRecord {
    const record = this.transactionRecords.get(txId);
    if (!record) {
      throw new Error(`Unknown transaction: ${txId}`);
    }

    return record;
  }

  registerTransaction(tx: Transaction) {
    this.transactionRecords.set(tx.id, {
      tx,
      phase: "active",
    });
    this.activeTransactionIdsByPriority.unshift(tx.id);
  }

  detachTransactionInstance(txId: string) {
    const record = this.getRequiredTransactionRecord(txId);
    record.tx = null;
    this.removeActiveTransactionId(txId);
  }

  getStatus(txId: string): TransactionStatus {
    return this.getRequiredTransactionRecord(txId).phase;
  }

  private markTransactionFinished(
    txId: string,
    phase: Exclude<TransactionStatus, "active">,
  ): TransactionStatus {
    const record = this.getRequiredTransactionRecord(txId);
    if (record.phase !== "active") {
      return record.phase;
    }

    record.phase = phase;
    this.removeActiveTransactionId(txId);
    return record.phase;
  }

  markTransactionCommitted(txId: string): TransactionStatus {
    return this.markTransactionFinished(txId, "committed");
  }

  markTransactionCanceled(txId: string): TransactionStatus {
    return this.markTransactionFinished(txId, "canceled");
  }

  onDurableIncrement(delta: StoreDelta) {
    if (this.activeTransactionIdsByPriority.length === 0) {
      return;
    }
    if (!hasUpdatedElementEntries(delta)) {
      return;
    }

    const txUndoOverrides = this.collectUndoOverrides(delta);
    if (txUndoOverrides.length === 0) {
      return;
    }

    mergeStoreDeltaSemantics(delta, { txUndoOverrides });
  }

  private collectUndoOverrides(delta: StoreDelta): TxUndoOverride[] {
    const overrides: TxUndoOverride[] = [];
    const reservedConsumedKeys = new Set<string>();

    for (const txId of this.activeTransactionIdsByPriority) {
      const record = this.transactionRecords.get(txId);
      if (!record || record.phase !== "active" || !record.tx) {
        continue;
      }

      const txOverrides = record.tx.collectUndoOverridesForDelta(
        delta,
        reservedConsumedKeys,
      );

      for (const override of txOverrides) {
        if (reservedConsumedKeys.has(override.consumedKey)) {
          continue;
        }

        reservedConsumedKeys.add(override.consumedKey);
        overrides.push(override);
      }
    }

    return overrides;
  }

  private resolveEffectiveDelta(
    delta: HistoryDelta,
    _context: HistoryEffectiveDeltaResolverContext,
  ): HistoryDelta {
    const txUndoOverrides = delta.semantics?.txUndoOverrides;
    if (!txUndoOverrides || txUndoOverrides.length === 0) {
      return delta;
    }

    const updatedEntries = getUpdatedElementEntries(delta);
    const insertedOverridesByElement = new Map<
      string,
      MutableElementUpdatedProps
    >();

    for (const override of txUndoOverrides) {
      if (!this.shouldApplyUndoOverride(override.txId)) {
        continue;
      }

      const currentEntry = updatedEntries[override.elementId];
      if (!currentEntry) {
        continue;
      }

      const prop = override.prop as ElementUpdatedPropName;
      const currentInsertedValue = currentEntry.inserted[prop];
      if (
        !isLedgerValueEqual(
          currentInsertedValue,
          override.expectedInsertedValue,
        )
      ) {
        // Guard against over-applying once the delta has already evolved.
        continue;
      }

      const elementOverrides = insertedOverridesByElement.get(
        override.elementId,
      );
      if (elementOverrides) {
        setElementUpdatedOverride(
          elementOverrides,
          prop,
          override.preTxBaselineValue,
        );
      } else {
        const nextOverrides: MutableElementUpdatedProps = {};
        setElementUpdatedOverride(
          nextOverrides,
          prop,
          override.preTxBaselineValue,
        );
        insertedOverridesByElement.set(override.elementId, nextOverrides);
      }
    }

    if (insertedOverridesByElement.size === 0) {
      return delta;
    }

    const nextUpdatedEntries: ElementUpdatedEntryMap = {
      ...updatedEntries,
    };
    for (const [elementId, insertedOverrides] of insertedOverridesByElement) {
      const currentEntry = updatedEntries[elementId];
      if (!currentEntry) {
        continue;
      }

      nextUpdatedEntries[elementId] = Delta.create(
        { ...currentEntry.deleted },
        { ...currentEntry.inserted, ...insertedOverrides },
      );
    }

    const effectiveElements = ElementsDelta.create(
      delta.elements.added,
      delta.elements.removed,
      nextUpdatedEntries,
    );

    return HistoryDelta.create(effectiveElements, delta.appState, {
      id: delta.id,
      semantics: delta.semantics,
    }) as HistoryDelta;
  }

  private shouldApplyUndoOverride(txId: string): boolean {
    const record = this.transactionRecords.get(txId);
    return !!record && record.phase !== "active";
  }

  create(): Transaction {
    return new Transaction(this.app, this);
  }
}
