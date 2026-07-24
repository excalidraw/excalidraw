import type { ElementUpdate } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawNonSelectionElement,
} from "@excalidraw/element/types";

import type { ObservedAppState } from "../types";

export type ElementPropName = Extract<keyof ExcalidrawElement, string>;

export type TouchedElementProps =
  | { kind: "all" }
  | { kind: "partial"; props: Set<ElementPropName> };

export type ElementChange = {
  id: ExcalidrawElement["id"];
  before: ExcalidrawElement | null;
  after: ExcalidrawElement | null;
  touchedProps: TouchedElementProps;
};

/** Per-element ledger record captured during a transaction session. */
export type TransactionLedgerEntry = {
  baselineElement: ExcalidrawElement | null;
  targetElement: ExcalidrawElement | null;
  touchedProps: TouchedElementProps;
};

/** Lifecycle state of a transaction. */
export type TransactionStatus = "active" | "committed" | "canceled";

/** Per-element partial patch used by tx.updateElements(). */
export type TransactionUpdatableElementType =
  ExcalidrawNonSelectionElement["type"];

export type TransactionElementOfType<
  TType extends TransactionUpdatableElementType,
> = Extract<ExcalidrawNonSelectionElement, { type: TType }>;

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
