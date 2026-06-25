import { deepCopyElement } from "@excalidraw/element";

import type { Mutable } from "@excalidraw/common/utility-types";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import {
  collectElementChanges,
  collectTouchedProps,
  getElementProp,
  hasTouchedProps,
  isLedgerValueEqual,
  mergeTouchedProps,
  setOrderedElementProp,
  shallowCopySceneElements,
  touchesWholeElement,
} from "./diff";

import type { TransactionLedgerEntry } from "./types";

/**
 * Keeps transaction-level scene mutations and materializes synthetic snapshots
 * for a single durable history commit.
 */
export class TransactionLedger {
  private readonly entries = new Map<string, TransactionLedgerEntry>();

  /** Whether the transaction has any net element mutations. */
  hasEntries() {
    return this.entries.size > 0;
  }

  /** Returns the ledger entry for an element, if any. */
  getEntry(elementId: string): TransactionLedgerEntry | undefined {
    return this.entries.get(elementId);
  }

  /** Releases all ledger entries. */
  clear() {
    this.entries.clear();
  }

  /** Records one element mutation step into the ledger. */
  recordStep(
    before: ReadonlyMap<string, ExcalidrawElement>,
    after: ReadonlyMap<string, ExcalidrawElement>,
  ) {
    for (const change of collectElementChanges(before, after)) {
      const {
        id: elementId,
        before: beforeElement,
        after: afterElement,
        touchedProps,
      } = change;

      const existing = this.entries.get(elementId);
      if (!existing) {
        this.entries.set(elementId, {
          baselineElement: beforeElement
            ? deepCopyElement(beforeElement)
            : null,
          targetElement: afterElement ? deepCopyElement(afterElement) : null,
          touchedProps,
        });
        continue;
      }

      existing.targetElement = afterElement
        ? deepCopyElement(afterElement)
        : null;
      existing.touchedProps = mergeTouchedProps(
        existing.touchedProps,
        touchedProps,
      );

      // Created then deleted inside one transaction leaves no durable footprint.
      if (!existing.baselineElement && !existing.targetElement) {
        this.entries.delete(elementId);
        continue;
      }
      if (!existing.baselineElement && existing.targetElement?.isDeleted) {
        this.entries.delete(elementId);
      }
    }
  }

  /**
   * Builds synthetic element before/after snapshots with a fixed
   * "live-wins-per-prop" strategy.
   */
  buildSyntheticSnapshots(live: ReadonlyMap<string, ExcalidrawElement>) {
    // Shallow copy — untouched elements stay as live references.
    // Only elements mutated in-place (prop-level updates) are deep-copied below.
    const elementsBefore = shallowCopySceneElements(live);
    const elementsAfter = shallowCopySceneElements(live);

    for (const [elementId, entry] of this.entries) {
      this.reconcileEntrySnapshots(
        elementId,
        entry,
        live,
        elementsBefore,
        elementsAfter,
      );
    }

    return { elementsBefore, elementsAfter };
  }

  private reconcileEntrySnapshots(
    elementId: string,
    entry: TransactionLedgerEntry,
    live: ReadonlyMap<string, ExcalidrawElement>,
    elementsBefore: SceneElementsMap,
    elementsAfter: SceneElementsMap,
  ) {
    if (!entry.baselineElement) {
      this.applyCreatedElementSnapshots(
        elementId,
        entry.targetElement,
        live,
        elementsBefore,
        elementsAfter,
      );
      return;
    }

    if (!entry.targetElement) {
      this.applyDeletedElementSnapshots(
        elementId,
        entry.baselineElement,
        live,
        elementsBefore,
        elementsAfter,
      );
      return;
    }

    this.applyUpdatedElementSnapshots(
      elementId,
      entry,
      live,
      elementsBefore,
      elementsAfter,
    );
  }

  private applyCreatedElementSnapshots(
    elementId: string,
    targetElement: ExcalidrawElement | null,
    live: ReadonlyMap<string, ExcalidrawElement>,
    elementsBefore: SceneElementsMap,
    elementsAfter: SceneElementsMap,
  ) {
    if (!targetElement) {
      return;
    }

    const liveElement = live.get(elementId) ?? null;
    if (
      !liveElement ||
      liveElement.isDeleted ||
      hasTouchedProps(collectTouchedProps(targetElement, liveElement))
    ) {
      return;
    }

    elementsBefore.delete(elementId);
    elementsAfter.set(
      elementId,
      deepCopyElement(targetElement) as OrderedExcalidrawElement,
    );
  }

  private applyDeletedElementSnapshots(
    elementId: string,
    baselineElement: ExcalidrawElement,
    live: ReadonlyMap<string, ExcalidrawElement>,
    elementsBefore: SceneElementsMap,
    elementsAfter: SceneElementsMap,
  ) {
    const liveElement = live.get(elementId) ?? null;
    if (liveElement && !liveElement.isDeleted) {
      return;
    }

    elementsBefore.set(
      elementId,
      deepCopyElement(baselineElement) as OrderedExcalidrawElement,
    );
    elementsAfter.delete(elementId);
  }

  private applyUpdatedElementSnapshots(
    elementId: string,
    entry: TransactionLedgerEntry,
    live: ReadonlyMap<string, ExcalidrawElement>,
    elementsBefore: SceneElementsMap,
    elementsAfter: SceneElementsMap,
  ) {
    const liveElement = live.get(elementId) ?? null;
    const targetElement = entry.targetElement;
    const baselineElement = entry.baselineElement;
    const beforeElement = elementsBefore.get(elementId);
    const afterElement = elementsAfter.get(elementId);

    if (
      !liveElement ||
      !baselineElement ||
      !targetElement ||
      !beforeElement ||
      !afterElement
    ) {
      return;
    }

    if (touchesWholeElement(entry.touchedProps)) {
      this.applyWholeElementSnapshots(
        elementId,
        baselineElement,
        targetElement,
        liveElement,
        elementsBefore,
        elementsAfter,
      );
      return;
    }

    this.applyPerPropSnapshots({
      entry,
      liveElement,
      baselineElement,
      targetElement,
      beforeElement,
      afterElement,
      elementId,
      elementsBefore,
      elementsAfter,
    });
  }

  private applyWholeElementSnapshots(
    elementId: string,
    baselineElement: ExcalidrawElement,
    targetElement: ExcalidrawElement,
    liveElement: ExcalidrawElement,
    elementsBefore: SceneElementsMap,
    elementsAfter: SceneElementsMap,
  ) {
    const hasLiveConflict = hasTouchedProps(
      collectTouchedProps(targetElement, liveElement),
    );
    if (hasLiveConflict) {
      return;
    }

    elementsBefore.set(
      elementId,
      deepCopyElement(baselineElement) as OrderedExcalidrawElement,
    );
    elementsAfter.set(
      elementId,
      deepCopyElement(targetElement) as OrderedExcalidrawElement,
    );
  }

  private applyPerPropSnapshots(args: {
    entry: TransactionLedgerEntry;
    liveElement: ExcalidrawElement;
    baselineElement: ExcalidrawElement;
    targetElement: ExcalidrawElement;
    beforeElement: ExcalidrawElement;
    afterElement: ExcalidrawElement;
    elementId: string;
    elementsBefore: SceneElementsMap;
    elementsAfter: SceneElementsMap;
  }) {
    const {
      entry,
      liveElement,
      baselineElement,
      targetElement,
      beforeElement,
      afterElement,
      elementId,
      elementsBefore,
      elementsAfter,
    } = args;

    // Deep-copy before mutating so we never touch live elements.
    const mutableBefore = deepCopyElement(
      beforeElement,
    ) as Mutable<OrderedExcalidrawElement>;
    const mutableAfter = deepCopyElement(
      afterElement,
    ) as Mutable<OrderedExcalidrawElement>;
    elementsBefore.set(elementId, mutableBefore as OrderedExcalidrawElement);
    elementsAfter.set(elementId, mutableAfter as OrderedExcalidrawElement);

    if (entry.touchedProps.kind !== "partial") {
      return;
    }

    let appliedProps = 0;
    for (const prop of entry.touchedProps.props) {
      const liveValue = getElementProp(liveElement, prop);
      const targetValue = getElementProp(targetElement, prop);
      if (!isLedgerValueEqual(liveValue, targetValue)) {
        continue;
      }

      setOrderedElementProp(
        mutableBefore,
        prop,
        getElementProp(baselineElement, prop),
      );
      setOrderedElementProp(mutableAfter, prop, targetValue);
      appliedProps += 1;
    }

    if (appliedProps === 0) {
      return;
    }

    mutableBefore.version = baselineElement.version;
    mutableBefore.versionNonce = baselineElement.versionNonce;
    mutableAfter.version = targetElement.version;
    mutableAfter.versionNonce = targetElement.versionNonce;
  }
}
