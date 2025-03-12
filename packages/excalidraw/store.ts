import { getDefaultAppState } from "./appState";
import { AppStateChange, ElementsChange } from "./change";
import { ENV } from "./constants";
import { newElementWith } from "./element/mutateElement";
import { deepCopyElement } from "./element/newElement";
import { Emitter } from "./emitter";
import { isShallowEqual } from "./utils";

import type { OrderedExcalidrawElement } from "./element/types";
import type { AppState, ObservedAppState } from "./types";
import type { ValueOf } from "./utility-types";

// hidden non-enumerable property for runtime checks
const hiddenObservedAppStateProp = "__observedAppState";

export const getObservedAppState = (appState: AppState): ObservedAppState => {
  const observedAppState = {
    name: appState.name,
    editingGroupId: appState.editingGroupId,
    viewBackgroundColor: appState.viewBackgroundColor,
    selectedElementIds: appState.selectedElementIds,
    selectedGroupIds: appState.selectedGroupIds,
    editingLinearElementId: appState.editingLinearElement?.elementId || null,
    selectedLinearElementId: appState.selectedLinearElement?.elementId || null,
    croppingElementId: appState.croppingElementId,
  };

  Reflect.defineProperty(observedAppState, hiddenObservedAppStateProp, {
    value: true,
    enumerable: false,
  });

  return observedAppState;
};

const isObservedAppState = (
  appState: AppState | ObservedAppState,
): appState is ObservedAppState =>
  !!Reflect.get(appState, hiddenObservedAppStateProp);

export const CaptureUpdateAction = {
  /**
   * Immediately undoable.
   *
   * Use for updates which should be captured.
   * Should be used for most of the local updates.
   *
   * These updates will _immediately_ make it to the local undo / redo stacks.
   */
  IMMEDIATELY: "IMMEDIATELY",
  /**
   * Never undoable.
   *
   * Use for updates which should never be recorded, such as remote updates
   * or scene initialization.
   *
   * These updates will _never_ make it to the local undo / redo stacks.
   */
  NEVER: "NEVER",
  /**
   * Eventually undoable.
   *
   * Use for updates which should not be captured immediately - likely
   * exceptions which are part of some async multi-step process. Otherwise, all
   * such updates would end up being captured with the next
   * `CaptureUpdateAction.IMMEDIATELY` - triggered either by the next `updateScene`
   * or internally by the editor.
   *
   * These updates will _eventually_ make it to the local undo / redo stacks.
   */
  EVENTUALLY: "EVENTUALLY",
} as const;

export type CaptureUpdateActionType = ValueOf<typeof CaptureUpdateAction>;

/**
 * Represent an increment to the Store.
 */
class StoreIncrementEvent {
  constructor(
    public readonly elementsChange: ElementsChange,
    public readonly appStateChange: AppStateChange,
  ) {}
}

/**
 * Store which captures the observed changes and emits them as `StoreIncrementEvent` events.
 *
 * @experimental this interface is experimental and subject to change.
 */
export interface IStore {
  onStoreIncrementEmitter: Emitter<[StoreIncrementEvent]>;
  get snapshot(): Snapshot;
  set snapshot(snapshot: Snapshot);

  /**
   * Use to schedule update of the snapshot, useful on updates for which we don't need to calculate increments (i.e. remote updates).
   */
  shouldUpdateSnapshot(): void;

  /**
   * Use to schedule calculation of a store increment.
   */
  shouldCaptureIncrement(): void;

  /**
   * Based on the scheduled operation, either only updates store snapshot or also calculates increment and emits the result as a `StoreIncrementEvent`.
   *
   * @emits StoreIncrementEvent when increment is calculated.
   */
  commit(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ): void;

  /**
   * Clears the store instance.
   */
  clear(): void;

  /**
   * Filters out yet uncomitted elements from `nextElements`, which are part of in-progress local async actions (ephemerals) and thus were not yet commited to the snapshot.
   *
   * This is necessary in updates in which we receive reconciled elements, already containing elements which were not yet captured by the local store (i.e. collab).
   */
  filterUncomittedElements(
    prevElements: Map<string, OrderedExcalidrawElement>,
    nextElements: Map<string, OrderedExcalidrawElement>,
  ): Map<string, OrderedExcalidrawElement>;
}

export class Store implements IStore {
  public readonly onStoreIncrementEmitter = new Emitter<
    [StoreIncrementEvent]
  >();

  private scheduledActions: Set<CaptureUpdateActionType> = new Set();
  private _snapshot = Snapshot.empty();

  public get snapshot() {
    return this._snapshot;
  }

  public set snapshot(snapshot: Snapshot) {
    this._snapshot = snapshot;
  }

  // TODO: Suspicious that this is called so many places. Seems error-prone.
  public shouldCaptureIncrement = () => {
    this.scheduleAction(CaptureUpdateAction.IMMEDIATELY);
  };

  public shouldUpdateSnapshot = () => {
    this.scheduleAction(CaptureUpdateAction.NEVER);
  };

  private scheduleAction = (action: CaptureUpdateActionType) => {
    this.scheduledActions.add(action);
    this.satisfiesScheduledActionsInvariant();
  };

  public commit = (
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ): void => {
    try {
      // Capture has precedence since it also performs update
      if (this.scheduledActions.has(CaptureUpdateAction.IMMEDIATELY)) {
        this.captureIncrement(elements, appState);
      } else if (this.scheduledActions.has(CaptureUpdateAction.NEVER)) {
        this.updateSnapshot(elements, appState);
      }
    } finally {
      this.satisfiesScheduledActionsInvariant();
      // Defensively reset all scheduled actions, potentially cleans up other runtime garbage
      this.scheduledActions = new Set();
    }
  };

  public captureIncrement = (
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ) => {
    const prevSnapshot = this.snapshot;
    const nextSnapshot = this.snapshot.maybeClone(elements, appState);

    // Optimisation, don't continue if nothing has changed
    if (prevSnapshot !== nextSnapshot) {
      // Calculate and record the changes based on the previous and next snapshot
      const elementsChange = nextSnapshot.meta.didElementsChange
        ? ElementsChange.calculate(prevSnapshot.elements, nextSnapshot.elements)
        : ElementsChange.empty();

      const appStateChange = nextSnapshot.meta.didAppStateChange
        ? AppStateChange.calculate(prevSnapshot.appState, nextSnapshot.appState)
        : AppStateChange.empty();

      if (!elementsChange.isEmpty() || !appStateChange.isEmpty()) {
        // Notify listeners with the increment
        this.onStoreIncrementEmitter.trigger(
          new StoreIncrementEvent(elementsChange, appStateChange),
        );
      }

      // Update snapshot
      this.snapshot = nextSnapshot;
    }
  };

  public updateSnapshot = (
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ) => {
    const nextSnapshot = this.snapshot.maybeClone(elements, appState);

    if (this.snapshot !== nextSnapshot) {
      // Update snapshot
      this.snapshot = nextSnapshot;
    }
  };

  public filterUncomittedElements = (
    prevElements: Map<string, OrderedExcalidrawElement>,
    nextElements: Map<string, OrderedExcalidrawElement>,
  ) => {
    for (const [id, prevElement] of prevElements.entries()) {
      const nextElement = nextElements.get(id);

      if (!nextElement) {
        // Nothing to care about here, elements were forcefully deleted
        continue;
      }

      const elementSnapshot = this.snapshot.elements.get(id);

      // Checks for in progress async user action
      if (!elementSnapshot) {
        // Detected yet uncomitted local element
        nextElements.delete(id);
      } else if (elementSnapshot.version < prevElement.version) {
        // Element was already commited, but the snapshot version is lower than current current local version
        nextElements.set(id, elementSnapshot);
      }
    }

    return nextElements;
  };

  public clear = (): void => {
    this.snapshot = Snapshot.empty();
    this.scheduledActions = new Set();
  };

  private satisfiesScheduledActionsInvariant = () => {
    if (!(this.scheduledActions.size >= 0 && this.scheduledActions.size <= 3)) {
      const message = `There can be at most three store actions scheduled at the same time, but there are "${this.scheduledActions.size}".`;
      console.error(message, this.scheduledActions.values());

      if (import.meta.env.DEV || import.meta.env.MODE === ENV.TEST) {
        throw new Error(message);
      }
    }
  };
}

export class Snapshot {
  private constructor(
    public readonly elements: Map<string, OrderedExcalidrawElement>,
    public readonly appState: ObservedAppState,
    public readonly meta: {
      didElementsChange: boolean;
      didAppStateChange: boolean;
      isEmpty?: boolean;
    } = {
      didElementsChange: false,
      didAppStateChange: false,
      isEmpty: false,
    },
  ) {}

  public static empty() {
    return new Snapshot(
      new Map(),
      getObservedAppState(getDefaultAppState() as AppState),
      { didElementsChange: false, didAppStateChange: false, isEmpty: true },
    );
  }

  public isEmpty() {
    return this.meta.isEmpty;
  }

  /**
   * Efficiently clone the existing snapshot, only if we detected changes.
   *
   * @returns same instance if there are no changes detected, new instance otherwise.
   */
  public maybeClone(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ) {
    const nextElementsSnapshot = this.maybeCreateElementsSnapshot(elements);
    const nextAppStateSnapshot = this.maybeCreateAppStateSnapshot(appState);

    let didElementsChange = false;
    let didAppStateChange = false;

    if (this.elements !== nextElementsSnapshot) {
      didElementsChange = true;
    }

    if (this.appState !== nextAppStateSnapshot) {
      didAppStateChange = true;
    }

    if (!didElementsChange && !didAppStateChange) {
      return this;
    }

    const snapshot = new Snapshot(nextElementsSnapshot, nextAppStateSnapshot, {
      didElementsChange,
      didAppStateChange,
    });

    return snapshot;
  }

  private maybeCreateAppStateSnapshot(
    appState: AppState | ObservedAppState | undefined,
  ) {
    if (!appState) {
      return this.appState;
    }

    // Not watching over everything from the app state, just the relevant props
    const nextAppStateSnapshot = !isObservedAppState(appState)
      ? getObservedAppState(appState)
      : appState;

    const didAppStateChange = this.detectChangedAppState(nextAppStateSnapshot);

    if (!didAppStateChange) {
      return this.appState;
    }

    return nextAppStateSnapshot;
  }

  private detectChangedAppState(nextObservedAppState: ObservedAppState) {
    return !isShallowEqual(this.appState, nextObservedAppState, {
      selectedElementIds: isShallowEqual,
      selectedGroupIds: isShallowEqual,
    });
  }

  private maybeCreateElementsSnapshot(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
  ) {
    if (!elements) {
      return this.elements;
    }

    const didElementsChange = this.detectChangedElements(elements);

    if (!didElementsChange) {
      return this.elements;
    }

    const elementsSnapshot = this.createElementsSnapshot(elements);
    return elementsSnapshot;
  }

  /**
   * Detect if there any changed elements.
   *
   * NOTE: we shouldn't just use `sceneVersionNonce` instead, as we need to call this before the scene updates.
   */
  private detectChangedElements(
    nextElements: Map<string, OrderedExcalidrawElement>,
  ) {
    if (this.elements === nextElements) {
      return false;
    }

    if (this.elements.size !== nextElements.size) {
      return true;
    }

    // loop from right to left as changes are likelier to happen on new elements
    const keys = Array.from(nextElements.keys());

    for (let i = keys.length - 1; i >= 0; i--) {
      const prev = this.elements.get(keys[i]);
      const next = nextElements.get(keys[i]);
      if (
        !prev ||
        !next ||
        prev.id !== next.id ||
        prev.versionNonce !== next.versionNonce
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform structural clone, cloning only elements that changed.
   */
  private createElementsSnapshot(
    nextElements: Map<string, OrderedExcalidrawElement>,
  ) {
    const clonedElements = new Map();

    for (const [id, prevElement] of this.elements.entries()) {
      // Clone previous elements, never delete, in case nextElements would be just a subset of previous elements
      // i.e. during collab, persist or whenenever isDeleted elements get cleared
      if (!nextElements.get(id)) {
        // When we cannot find the prev element in the next elements, we mark it as deleted
        clonedElements.set(
          id,
          newElementWith(prevElement, { isDeleted: true }),
        );
      } else {
        clonedElements.set(id, prevElement);
      }
    }

    for (const [id, nextElement] of nextElements.entries()) {
      const prevElement = clonedElements.get(id);

      // At this point our elements are reconcilled already, meaning the next element is always newer
      if (
        !prevElement || // element was added
        (prevElement && prevElement.versionNonce !== nextElement.versionNonce) // element was updated
      ) {
        clonedElements.set(id, deepCopyElement(nextElement));
      }
    }

    return clonedElements;
  }
}
