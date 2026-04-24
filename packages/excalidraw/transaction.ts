import { randomId } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  Delta,
  deepCopyElement,
  ElementsDelta,
  mergeStoreDeltaSemantics,
  newElementWith,
  type ElementUpdate,
  type StoreDelta,
  type TxUndoOverride,
} from "@excalidraw/element";

import type { Mutable } from "@excalidraw/common/utility-types";
import type {
  ExcalidrawElement,
  ExcalidrawNonSelectionElement,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import {
  HistoryDelta,
  type HistoryBeforeRecordListener,
  type HistoryEffectiveDeltaResolverContext,
} from "./history";

import type {
  AppClassProperties,
  AppState,
  ObservedAppState,
  SceneData,
} from "./types";

/** Per-element ledger record captured during a transaction session. */
export type TransactionLedgerEntry = {
  baselineElement: ExcalidrawElement | null;
  targetElement: ExcalidrawElement | null;
  touchedProps: Set<string>;
};

// ---------------------------------------------------------------------------
// Ledger helpers
// ---------------------------------------------------------------------------

const LEDGER_IGNORED_PROPS = new Set([
  "version",
  "versionNonce",
  "seed",
  "updated",
  "index",
]);

type ElementRecord = Record<string, unknown>;
type ElementUpdatedEntry = Delta<Record<string, unknown>>;
type ElementUpdatedEntryMap = Record<string, ElementUpdatedEntry>;
type TransactionMap = Map<string, Transaction>;
type TransactionLifecyclePhase = "active" | "committed" | "canceled";
type TransactionLifecycleRecord = {
  phase: TransactionLifecyclePhase;
  startedSeq: number;
  endedSeq?: number;
};
type TransactionLifecycleMap = Map<string, TransactionLifecycleRecord>;
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const getElementProp = (element: ExcalidrawElement, prop: string): unknown =>
  (element as ElementRecord)[prop];

const setOrderedElementProp = (
  element: Mutable<OrderedExcalidrawElement>,
  prop: string,
  value: unknown,
) => {
  (element as ElementRecord)[prop] = value;
};

/** Deep equality used by ledger conflict/touched-prop detection. */
const isLedgerValueEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isLedgerValueEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }
      if (!isLedgerValueEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
};

/** Shallow-copies a scene map. Entries share references with the original. */
const shallowCopySceneMap = (
  elements: ReadonlyMap<string, ExcalidrawElement>,
): SceneElementsMap => new Map(elements) as SceneElementsMap;

/** Returns changed property names between two element snapshots. */
const collectTouchedProps = (
  before: ExcalidrawElement | null,
  after: ExcalidrawElement | null,
) => {
  if (!before || !after) {
    return new Set<string>(["*"]);
  }

  const touchedProps = new Set<string>();
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (LEDGER_IGNORED_PROPS.has(key)) {
      continue;
    }
    if (
      !isLedgerValueEqual(
        getElementProp(before, key),
        getElementProp(after, key),
      )
    ) {
      touchedProps.add(key);
    }
  }

  return touchedProps;
};

/** Returns ids whose element snapshot changed between two points in time. */
export const collectChangedElementIds = (
  before: ReadonlyMap<string, ExcalidrawElement>,
  after: ReadonlyMap<string, ExcalidrawElement>,
) => {
  const changedIds = new Set<string>();
  const candidateIds = new Set<string>([...before.keys(), ...after.keys()]);

  for (const id of candidateIds) {
    const beforeElement = before.get(id) ?? null;
    const afterElement = after.get(id) ?? null;
    if (collectTouchedProps(beforeElement, afterElement).size > 0) {
      changedIds.add(id);
    }
  }

  return [...changedIds];
};

const serializeConsumedPropKey = (elementId: string, prop: string) =>
  `${elementId}\u0000${prop}`;

const TX_UNDO_OVERRIDE_IGNORED_PROPS = new Set([
  "version",
  "versionNonce",
  "isDeleted",
]);

const getUpdatedElementEntries = (delta: StoreDelta) =>
  delta.elements.updated as ElementUpdatedEntryMap;
const hasUpdatedElementEntries = (delta: StoreDelta) =>
  Object.keys(getUpdatedElementEntries(delta)).length > 0;

const serializeIntermediateValue = (value: unknown): string => {
  const serialize = (input: unknown, seen: WeakSet<object>): string => {
    if (input === null) {
      return "null";
    }

    switch (typeof input) {
      case "undefined":
        return "undefined";
      case "boolean":
        return input ? "boolean:true" : "boolean:false";
      case "number":
        if (Number.isNaN(input)) {
          return "number:NaN";
        }
        if (Object.is(input, -0)) {
          return "number:-0";
        }
        return `number:${input}`;
      case "bigint":
        return `bigint:${input.toString()}`;
      case "string":
        return `string:${JSON.stringify(input)}`;
      case "symbol":
        return `symbol:${String(input)}`;
      case "function":
        return `function:${input.name}`;
      case "object":
        break;
      default:
        return `unknown:${String(input)}`;
    }

    if (Array.isArray(input)) {
      if (seen.has(input)) {
        return "[CircularArray]";
      }
      seen.add(input);
      const serialized = `[${input
        .map((item) => serialize(item, seen))
        .join(",")}]`;
      seen.delete(input);
      return serialized;
    }

    if (isPlainObject(input)) {
      if (seen.has(input)) {
        return "{CircularObject}";
      }
      seen.add(input);
      const serialized = `{${Object.keys(input)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${serialize(input[key], seen)}`)
        .join(",")}}`;
      seen.delete(input);
      return serialized;
    }

    try {
      return `object:${JSON.stringify(input)}`;
    } catch {
      return `object:${Object.prototype.toString.call(input)}`;
    }
  };

  return serialize(value, new WeakSet<object>());
};

type TxUndoOverrideCandidate = Omit<TxUndoOverride, "txId">;
type TxIntermediatePropValues = {
  values: unknown[];
  signatures: Set<string>;
  latestValue: unknown;
  hasLatestValue: boolean;
};

/**
 * Tracks tx intermediate values and computes undo baseline override markers
 * for durable user deltas recorded while tx is active.
 */
class TxUndoOverridePlanner {
  private readonly intermediateValuesByElementProp = new Map<
    string,
    Map<string, TxIntermediatePropValues>
  >();
  private readonly consumedOverridePropKeys = new Set<string>();

  clear() {
    this.consumedOverridePropKeys.clear();
    this.intermediateValuesByElementProp.clear();
  }

  recordStep(
    before: ReadonlyMap<string, ExcalidrawElement>,
    after: ReadonlyMap<string, ExcalidrawElement>,
  ) {
    for (const elementId of collectChangedElementIds(before, after)) {
      const beforeElement = before.get(elementId) ?? null;
      const afterElement = after.get(elementId) ?? null;
      const touchedProps = collectTouchedProps(beforeElement, afterElement);

      if (!afterElement || touchedProps.has("*")) {
        continue;
      }

      for (const prop of touchedProps) {
        this.recordIntermediateValue(
          elementId,
          prop,
          getElementProp(afterElement, prop),
        );
      }
    }
  }

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

  private collectCandidatesForElement(
    elementId: string,
    deltaEntry: ElementUpdatedEntry,
    ledgerEntry: TransactionLedgerEntry,
    reservedConsumedKeys: Set<string>,
  ): TxUndoOverrideCandidate[] {
    const { baselineElement, touchedProps } = ledgerEntry;
    if (!baselineElement || touchedProps.has("*")) {
      return [];
    }

    const candidates: TxUndoOverrideCandidate[] = [];
    for (const [prop, deletedValue] of Object.entries(deltaEntry.deleted)) {
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

  private createCandidateForProp(args: {
    elementId: string;
    prop: string;
    deletedValue: unknown;
    baselineElement: ExcalidrawElement;
    touchedProps: Set<string>;
    reservedConsumedKeys: Set<string>;
  }): TxUndoOverrideCandidate | null {
    const { elementId, prop, deletedValue, baselineElement, touchedProps } =
      args;

    if (TX_UNDO_OVERRIDE_IGNORED_PROPS.has(prop) || !touchedProps.has(prop)) {
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

  markConsumed(consumedPropKey: string) {
    this.consumedOverridePropKeys.add(consumedPropKey);
  }

  private getOrCreatePropValues(elementId: string) {
    const existing = this.intermediateValuesByElementProp.get(elementId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, TxIntermediatePropValues>();
    this.intermediateValuesByElementProp.set(elementId, created);
    return created;
  }

  private recordIntermediateValue(
    elementId: string,
    prop: string,
    value: unknown,
  ) {
    const propValues = this.getOrCreatePropValues(elementId);
    const prevValues = propValues.get(prop);
    if (prevValues) {
      if (
        prevValues.hasLatestValue &&
        isLedgerValueEqual(prevValues.latestValue, value)
      ) {
        return;
      }

      prevValues.values.push(value);
      prevValues.signatures.add(serializeIntermediateValue(value));
      prevValues.latestValue = value;
      prevValues.hasLatestValue = true;
      return;
    }

    propValues.set(prop, {
      values: [value],
      signatures: new Set([serializeIntermediateValue(value)]),
      latestValue: value,
      hasLatestValue: true,
    });
  }

  private matchesIntermediateValue(
    elementId: string,
    prop: string,
    candidate: unknown,
  ) {
    const propValues = this.intermediateValuesByElementProp
      .get(elementId)
      ?.get(prop);
    if (!propValues) {
      return false;
    }

    const candidateSignature = serializeIntermediateValue(candidate);
    if (!propValues.signatures.has(candidateSignature)) {
      return false;
    }

    if (
      propValues.hasLatestValue &&
      isLedgerValueEqual(propValues.latestValue, candidate)
    ) {
      return true;
    }

    return propValues.values.some((value) =>
      isLedgerValueEqual(value, candidate),
    );
  }
}

// ---------------------------------------------------------------------------
// TransactionLedger
// ---------------------------------------------------------------------------

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
    for (const elementId of collectChangedElementIds(before, after)) {
      const beforeElement = before.get(elementId) ?? null;
      const afterElement = after.get(elementId) ?? null;
      const touchedProps = collectTouchedProps(beforeElement, afterElement);

      if (touchedProps.size === 0) {
        continue;
      }

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
      if (existing.touchedProps.has("*") || touchedProps.has("*")) {
        existing.touchedProps = new Set(["*"]);
      } else {
        for (const prop of touchedProps) {
          existing.touchedProps.add(prop);
        }
      }

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
    const elementsBefore = shallowCopySceneMap(live);
    const elementsAfter = shallowCopySceneMap(live);

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
      collectTouchedProps(targetElement, liveElement).size > 0
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

    if (entry.touchedProps.has("*")) {
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
    const hasLiveConflict =
      collectTouchedProps(targetElement, liveElement).size > 0;
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

    let appliedProps = 0;
    for (const prop of entry.touchedProps) {
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

// ---------------------------------------------------------------------------
// Transaction types
// ---------------------------------------------------------------------------

/** Lifecycle state of a transaction. */
export type TransactionStatus = "active" | "committed" | "canceled";

/** Per-element partial patch used by tx.updateElements(). */
type TransactionUpdatableElementType = ExcalidrawNonSelectionElement["type"];
type TransactionElementOfType<TType extends TransactionUpdatableElementType> =
  Extract<ExcalidrawNonSelectionElement, { type: TType }>;

export type TransactionElementUpdate<
  TType extends TransactionUpdatableElementType = TransactionUpdatableElementType,
> = TType extends TransactionUpdatableElementType
  ? {
      id: ExcalidrawElement["id"];
      type: TType;
      updates: ElementUpdate<TransactionElementOfType<TType>>;
    }
  : never;

/** Final summary returned when a transaction is committed or canceled. */
export type TransactionSummary = {
  id: string;
  status: TransactionStatus;
  historyCommitted: boolean;
};

/** Three-way appState context provided to the resolver at commit time. */
export type AppStateResolverContext = {
  /** AppState snapshot captured when the transaction was created. */
  initial: Partial<ObservedAppState>;
  /** Merged appState intent from all updateScene calls during the transaction. */
  accumulated: Partial<ObservedAppState>;
  /** Current live appState at commit time. */
  live: Partial<ObservedAppState>;
};

/**
 * Caller-provided resolver that determines which appState changes are
 * recorded in the history entry.
 *
 * Unlike elements — where per-property conflict detection works because
 * element properties are largely independent — appState keys are often
 * interdependent (e.g. selectedElementIds ↔ selectedGroupIds must stay
 * consistent). The correct merge strategy therefore depends on the
 * caller's semantic context, not on a generic policy.
 *
 * Return the appState delta to record in history, or undefined to skip
 * appState changes entirely.
 */
export type AppStateResolver = (
  context: AppStateResolverContext,
) => Partial<ObservedAppState> | undefined;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Shallow-copies the scene's elements map so that in-place mutations
 * (e.g. replaceAllElements clearing the map) don't affect our snapshot.
 *
 * Element references are shared — this is safe because:
 * - updateScene creates new element objects for changed properties
 * - syncInvalidIndices may mutate `index` in-place, but `index` is in
 *   LEDGER_IGNORED_PROPS so the ledger never considers it
 * - the ledger deep-copies only the elements it actually records
 */
const shallowSnapshotElements = (
  elementsMap: Map<string, ExcalidrawElement>,
): Map<string, ExcalidrawElement> => new Map(elementsMap);

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

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
  private statusValue: TransactionStatus = "active";
  private cachedSummary: TransactionSummary | null = null;

  constructor(app: AppClassProperties, manager: TransactionManager) {
    this.app = app;
    this.manager = manager;
    this.initialAppState = { ...app.store.snapshot.appState };
    this.manager.registerTransaction(this);
  }

  get status(): TransactionStatus {
    return this.statusValue;
  }

  private assertActive(action: string): void {
    if (this.statusValue !== "active") {
      throw new Error(
        `Cannot ${action} — transaction ${this.id} is already ${this.statusValue}.`,
      );
    }
  }

  private closeTransaction() {
    this.manager.unregisterTransaction(this.id);
    this.undoOverridePlanner.clear();
  }

  public collectUndoOverridesForDelta(
    delta: StoreDelta,
    reservedConsumedKeys: Set<string>,
  ): TxUndoOverride[] {
    if (this.statusValue !== "active") {
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
    const before = shallowSnapshotElements(
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

  commit(options?: {
    /**
     * Resolver that determines which appState changes are recorded in the
     * history entry.
     *
     * AppState keys are often interdependent (e.g. selectedElementIds ↔
     * selectedGroupIds) and the correct merge depends on the caller's
     * semantic context — a generic conflict policy cannot cover these cases.
     * The resolver receives all three states (initial, accumulated, live) so
     * the caller can make an informed decision.
     *
     * When omitted, the accumulated appState from updateScene calls is used
     * as-is — suitable when the caller has already ensured correctness at
     * each updateScene step.
     */
    resolveAppState?: AppStateResolver;
  }): TransactionSummary {
    if (this.cachedSummary) {
      return this.cachedSummary;
    }

    this.markCommittedIfActive();
    const historyCommitted = this.shouldCommitHistory()
      ? this.commitHistoryEntry(options)
      : false;

    this.closeTransaction();
    this.cachedSummary = {
      id: this.id,
      status: this.statusValue,
      historyCommitted,
    };
    this.ledger.clear();
    return this.cachedSummary;
  }

  private markCommittedIfActive() {
    if (this.statusValue === "active") {
      this.statusValue = "committed";
      this.manager.markTransactionPhase(this.id, "committed");
    }
  }

  private shouldCommitHistory() {
    return this.statusValue === "committed" && this.hasPendingWork();
  }

  private hasPendingWork() {
    return this.ledger.hasEntries() || this.hasAccumulatedAppStateIntent();
  }

  private hasAccumulatedAppStateIntent() {
    return Object.keys(this.accumulatedAppState).length > 0;
  }

  private commitHistoryEntry(options?: { resolveAppState?: AppStateResolver }) {
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

  private resolveCommitAppStateDelta(options?: {
    resolveAppState?: AppStateResolver;
  }): Partial<ObservedAppState> | undefined {
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

    if (this.statusValue === "active") {
      this.statusValue = "canceled";
      this.manager.markTransactionPhase(this.id, "canceled");
    }

    this.closeTransaction();
    this.cachedSummary = {
      id: this.id,
      status: this.statusValue,
      historyCommitted: false,
    };
    this.ledger.clear();
    return this.cachedSummary;
  }
}

// ---------------------------------------------------------------------------
// TransactionManager
// ---------------------------------------------------------------------------

/**
 * Thin factory that holds the app reference and creates Transaction instances.
 */
export class TransactionManager {
  private readonly app: AppClassProperties;
  private readonly activeTransactions: TransactionMap = new Map();
  private readonly activeTransactionsByStartedSeqDesc: Transaction[] = [];
  private readonly transactionLifecycle: TransactionLifecycleMap = new Map();
  private detachBeforeRecordHook: (() => void) | null = null;
  private sequence = 0;

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

  registerTransaction(tx: Transaction) {
    const startedSeq = this.nextSequence();
    this.activeTransactions.set(tx.id, tx);
    this.activeTransactionsByStartedSeqDesc.unshift(tx);
    this.transactionLifecycle.set(tx.id, {
      phase: "active",
      startedSeq,
    });
  }

  unregisterTransaction(txId: string) {
    this.activeTransactions.delete(txId);
    const txIndex = this.activeTransactionsByStartedSeqDesc.findIndex(
      (tx) => tx.id === txId,
    );
    if (txIndex >= 0) {
      this.activeTransactionsByStartedSeqDesc.splice(txIndex, 1);
    }
  }

  markTransactionPhase(
    txId: string,
    phase: Exclude<TransactionStatus, "active">,
  ) {
    const record = this.transactionLifecycle.get(txId);
    if (!record || record.phase !== "active") {
      return;
    }

    record.phase = phase;
    record.endedSeq = this.nextSequence();
  }

  onDurableIncrement(delta: StoreDelta) {
    if (this.activeTransactions.size === 0) {
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

    for (const tx of this.activeTransactionsByStartedSeqDesc) {
      const txOverrides = tx.collectUndoOverridesForDelta(
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
      Record<string, unknown>
    >();

    for (const override of txUndoOverrides) {
      if (!this.shouldApplyUndoOverride(override.txId)) {
        continue;
      }

      const currentEntry = updatedEntries[override.elementId];
      if (!currentEntry) {
        continue;
      }

      const currentInsertedValue = currentEntry.inserted[override.prop];
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
        elementOverrides[override.prop] = override.preTxBaselineValue;
      } else {
        insertedOverridesByElement.set(override.elementId, {
          [override.prop]: override.preTxBaselineValue,
        });
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
    const lifecycle = this.transactionLifecycle.get(txId);
    return !!lifecycle && lifecycle.phase !== "active";
  }

  private nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  create(): Transaction {
    return new Transaction(this.app, this);
  }
}
