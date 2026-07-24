import type { StoreDelta, TxUndoOverride } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  TX_UNDO_OVERRIDE_IGNORED_PROPS,
  collectElementChanges,
  getElementProp,
  getElementPropEntries,
  getUpdatedElementEntries,
  hasTouchedProp,
  isPartialTouchedProps,
  isLedgerValueEqual,
  serializeConsumedPropKey,
  serializeIntermediateValue,
  touchesWholeElement,
  type ElementUpdatedEntry,
} from "./diff";

import type {
  ElementPropName,
  TouchedElementProps,
  TransactionLedgerEntry,
} from "./types";

type TxUndoOverrideCandidate = Omit<TxUndoOverride, "txId">;

/**
 * Per-element-prop history of tx intermediate values.
 *
 * We keep:
 * - the full sequence for exact deep-equality fallback
 * - a serialized signature set for fast negative lookups
 * - the latest value for the most common positive lookup path
 */
class TxIntermediateValueHistory {
  private readonly values: unknown[] = [];
  private readonly signatures = new Set<string>();
  private latestValue: unknown;
  private hasLatestValue = false;

  /** Appends a new intermediate value, skipping consecutive duplicates. */
  add(value: unknown) {
    if (this.hasLatestValue && isLedgerValueEqual(this.latestValue, value)) {
      return;
    }

    this.values.push(value);
    this.signatures.add(serializeIntermediateValue(value));
    this.latestValue = value;
    this.hasLatestValue = true;
  }

  /** Returns whether the candidate appeared in this tx prop history. */
  contains(candidate: unknown) {
    const candidateSignature = serializeIntermediateValue(candidate);
    if (!this.signatures.has(candidateSignature)) {
      return false;
    }

    if (
      this.hasLatestValue &&
      isLedgerValueEqual(this.latestValue, candidate)
    ) {
      return true;
    }

    return this.values.some((value) => isLedgerValueEqual(value, candidate));
  }
}

/**
 * Tracks tx intermediate values and computes undo baseline override markers
 * for durable user deltas recorded while tx is active.
 *
 * High-level flow:
 * 1. `recordStep()` observes every in-tx scene mutation and records the
 *    intermediate value reached by each touched element prop.
 * 2. When a durable user delta is about to be recorded,
 *    `collectCandidatesForDurableDelta()` checks whether that delta's
 *    deleted-baseline values match any tx intermediate value.
 * 3. If they do, we emit override candidates so undo can restore the pre-tx
 *    baseline once the tx has ended.
 * 4. `markConsumed()` ensures only the first polluted durable entry for a
 *    given element+prop gets patched; later user actions keep their own
 *    action-local undo baseline.
 */
export class TxUndoOverridePlanner {
  private readonly intermediateValuesByElementProp = new Map<
    string,
    Map<ElementPropName, TxIntermediateValueHistory>
  >();
  private readonly consumedOverridePropKeys = new Set<string>();

  /** Resets planner state when the transaction finishes. */
  clear() {
    this.consumedOverridePropKeys.clear();
    this.intermediateValuesByElementProp.clear();
  }

  /** Records per-prop intermediate values reached by one in-tx scene step. */
  recordStep(
    before: ReadonlyMap<string, ExcalidrawElement>,
    after: ReadonlyMap<string, ExcalidrawElement>,
  ) {
    for (const change of collectElementChanges(before, after)) {
      const { id: elementId, after: afterElement, touchedProps } = change;

      if (!afterElement || !isPartialTouchedProps(touchedProps)) {
        continue;
      }

      for (const prop of touchedProps.props) {
        this.recordIntermediateValue(
          elementId,
          prop,
          getElementProp(afterElement, prop),
        );
      }
    }
  }

  /**
   * Collects override candidates for one durable user delta recorded while the
   * tx is active.
   */
  collectCandidatesForDurableDelta(
    delta: StoreDelta,
    getLedgerEntry: (elementId: string) => TransactionLedgerEntry | undefined,
    reservedConsumedKeys: Set<string>,
  ): TxUndoOverrideCandidate[] {
    const candidates: TxUndoOverrideCandidate[] = [];

    for (const [elementId, deltaEntry] of Object.entries(
      getUpdatedElementEntries(delta),
    )) {
      const ledgerEntry = getLedgerEntry(elementId);
      if (!ledgerEntry) {
        continue;
      }

      const elementCandidates = this.collectCandidatesForElement(
        elementId,
        deltaEntry,
        ledgerEntry,
        reservedConsumedKeys,
      );
      if (elementCandidates.length > 0) {
        candidates.push(...elementCandidates);
      }
    }

    return candidates;
  }

  /** Evaluates one element's updated entry against the tx ledger snapshot. */
  private collectCandidatesForElement(
    elementId: string,
    deltaEntry: ElementUpdatedEntry,
    ledgerEntry: TransactionLedgerEntry,
    reservedConsumedKeys: Set<string>,
  ): TxUndoOverrideCandidate[] {
    const { baselineElement, touchedProps } = ledgerEntry;
    if (!baselineElement || touchesWholeElement(touchedProps)) {
      return [];
    }

    const candidates: TxUndoOverrideCandidate[] = [];
    for (const [prop, deletedValue] of getElementPropEntries(
      deltaEntry.deleted,
    )) {
      const candidate = this.createCandidateForProp({
        elementId,
        prop,
        deletedValue,
        baselineElement,
        touchedProps,
        reservedConsumedKeys,
      });
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  /**
   * Returns an override candidate for one element+prop when the durable delta's
   * deleted baseline was polluted by a tx intermediate value.
   */
  private createCandidateForProp(args: {
    elementId: string;
    prop: ElementPropName;
    deletedValue: unknown;
    baselineElement: ExcalidrawElement;
    touchedProps: TouchedElementProps;
    reservedConsumedKeys: Set<string>;
  }): TxUndoOverrideCandidate | null {
    const { elementId, prop, deletedValue, baselineElement, touchedProps } =
      args;

    if (
      TX_UNDO_OVERRIDE_IGNORED_PROPS.has(prop) ||
      !hasTouchedProp(touchedProps, prop)
    ) {
      return null;
    }

    const consumedPropKey = serializeConsumedPropKey(elementId, prop);
    // Override only the first polluted user entry for this element+prop.
    // Later user actions should keep action-local undo baselines.
    if (
      this.consumedOverridePropKeys.has(consumedPropKey) ||
      args.reservedConsumedKeys.has(consumedPropKey)
    ) {
      return null;
    }

    if (!this.matchesIntermediateValue(elementId, prop, deletedValue)) {
      return null;
    }

    return {
      elementId,
      prop,
      expectedInsertedValue: deletedValue,
      preTxBaselineValue: getElementProp(baselineElement, prop),
      consumedKey: consumedPropKey,
    };
  }

  /** Marks an element+prop override as consumed by an earlier durable entry. */
  markConsumed(consumedPropKey: string) {
    this.consumedOverridePropKeys.add(consumedPropKey);
  }

  /** Returns the per-prop history map for one element, creating it if needed. */
  private getOrCreatePropValues(elementId: string) {
    const existing = this.intermediateValuesByElementProp.get(elementId);
    if (existing) {
      return existing;
    }

    const created = new Map<ElementPropName, TxIntermediateValueHistory>();
    this.intermediateValuesByElementProp.set(elementId, created);
    return created;
  }

  /** Appends one observed intermediate value for an element prop. */
  private recordIntermediateValue(
    elementId: string,
    prop: ElementPropName,
    value: unknown,
  ) {
    const propValues = this.getOrCreatePropValues(elementId);
    const history = propValues.get(prop);
    if (history) {
      history.add(value);
      return;
    }

    const nextHistory = new TxIntermediateValueHistory();
    nextHistory.add(value);
    propValues.set(prop, nextHistory);
  }

  /** Checks whether a durable delta baseline matches any tx intermediate value. */
  private matchesIntermediateValue(
    elementId: string,
    prop: ElementPropName,
    candidate: unknown,
  ) {
    const history = this.intermediateValuesByElementProp
      .get(elementId)
      ?.get(prop);
    if (!history) {
      return false;
    }

    return history.contains(candidate);
  }
}
