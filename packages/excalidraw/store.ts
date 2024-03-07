import { getDefaultAppState } from "./appState";
import { AppStateChange, ElementsChange } from "./change";
import { newElementWith } from "./element/mutateElement";
import { deepCopyElement } from "./element/newElement";
import { OrderedExcalidrawElement } from "./element/types";
import { Emitter } from "./emitter";
import { AppState, ObservedAppState } from "./types";
import { isShallowEqual } from "./utils";

const getObservedAppState = (appState: AppState): ObservedAppState => {
  return {
    name: appState.name,
    editingGroupId: appState.editingGroupId,
    viewBackgroundColor: appState.viewBackgroundColor,
    selectedElementIds: appState.selectedElementIds,
    selectedGroupIds: appState.selectedGroupIds,
    editingLinearElement: appState.editingLinearElement,
  };
};

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
   * Use to schedule update of the snapshot, useful on updates for which we don't need to calculate increments (i.e. such as remote updates).
   */
  shouldUpdateSnapshot(): void;

  /**
   * Use to schedule calculation of a store increment on a next component update.
   */
  shouldCaptureIncrement(): void;

  /**
   * Capture changes to the `elements` and `appState` by calculating changes (based on a snapshot) and emitting resulting changes as a store increment.
   *
   * @emits StoreIncrementEvent
   */
  capture(
    elements: Map<string, OrderedExcalidrawElement>,
    appState: AppState,
  ): void;

  /**
   * Clears the store instance.
   */
  clear(): void;

  /**
   * Filters out yet uncomitted elements from `nextElements`, which are part of in-progress local async actions (ephemerals) and thus were not yet commited to the snapshot.
   *
   * This is necessary in updates in which we receive reconciled elements, already containing elements which were not yet captured by the local store (i.e. collab).
   *
   * Once we will be exchanging just store increments for all ephemerals, this could be deprecated.
   */
  ignoreUncomittedElements(
    prevElements: Map<string, OrderedExcalidrawElement>,
    nextElements: Map<string, OrderedExcalidrawElement>,
  ): Map<string, OrderedExcalidrawElement>;
}

/**
 * Represent an increment to the Store.
 */
class StoreIncrementEvent {
  constructor(
    public readonly elementsChange: ElementsChange,
    public readonly appStateChange: AppStateChange,
  ) {}
}

export class Store implements IStore {
  public readonly onStoreIncrementEmitter = new Emitter<
    [StoreIncrementEvent]
  >();

  private calculatingIncrement: boolean = false;
  private updatingSnapshot: boolean = false;

  private _snapshot = Snapshot.empty();

  public get snapshot() {
    return this._snapshot;
  }

  public set snapshot(snapshot: Snapshot) {
    this._snapshot = snapshot;
  }

  public shouldUpdateSnapshot = () => {
    this.updatingSnapshot = true;
  };

  // Suspicious that this is called so many places. Seems error-prone.
  public shouldCaptureIncrement = () => {
    this.calculatingIncrement = true;
  };

  public capture = (
    elements: Map<string, OrderedExcalidrawElement>,
    appState: AppState,
  ): void => {
    // Quick exit for irrelevant changes
    if (!this.calculatingIncrement && !this.updatingSnapshot) {
      return;
    }

    try {
      const nextSnapshot = this._snapshot.clone(elements, appState);

      // Optimisation, don't continue if nothing has changed
      if (this._snapshot !== nextSnapshot) {
        // Calculate and record the changes based on the previous and next snapshot
        if (this.calculatingIncrement) {
          const elementsChange = nextSnapshot.meta.didElementsChange
            ? ElementsChange.calculate(
                this._snapshot.elements,
                nextSnapshot.elements,
              )
            : ElementsChange.empty();

          const appStateChange = nextSnapshot.meta.didAppStateChange
            ? AppStateChange.calculate(
                this._snapshot.appState,
                nextSnapshot.appState,
              )
            : AppStateChange.empty();

          if (!elementsChange.isEmpty() || !appStateChange.isEmpty()) {
            // Notify listeners with the increment
            this.onStoreIncrementEmitter.trigger(
              new StoreIncrementEvent(elementsChange, appStateChange),
            );
          }
        }

        // Update the snapshot
        this._snapshot = nextSnapshot;
      }
    } finally {
      // Reset props
      this.updatingSnapshot = false;
      this.calculatingIncrement = false;
    }
  };

  public ignoreUncomittedElements = (
    prevElements: Map<string, OrderedExcalidrawElement>,
    nextElements: Map<string, OrderedExcalidrawElement>,
  ) => {
    for (const [id, prevElement] of prevElements.entries()) {
      const nextElement = nextElements.get(id);

      if (!nextElement) {
        // Nothing to care about here, elements were forcefully updated
        continue;
      }

      const elementSnapshot = this._snapshot.elements.get(id);

      // Uncomitted element's snapshot doesn't exist, or its snapshot has lower version than the local element
      if (
        !elementSnapshot ||
        (elementSnapshot && elementSnapshot.version < prevElement.version)
      ) {
        // Detected yet uncomitted local element ~ async user action is in progress
        if (elementSnapshot) {
          nextElements.set(id, elementSnapshot);
        } else {
          nextElements.delete(id);
        }
      }
    }

    return nextElements;
  };

  public clear = (): void => {
    this._snapshot = Snapshot.empty();
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
   * Efficiently clone the existing snapshot.
   *
   * @returns same instance if there are no changes detected, new instance otherwise.
   */
  public clone(
    elements: Map<string, OrderedExcalidrawElement>,
    appState: AppState,
  ) {
    const didElementsChange = this.detectChangedElements(elements);

    // Not watching over everything from app state, just the relevant props
    const nextAppStateSnapshot = getObservedAppState(appState);
    const didAppStateChange = this.detectChangedAppState(nextAppStateSnapshot);

    // Nothing has changed, so there is no point of continuing further
    if (!didElementsChange && !didAppStateChange) {
      return this;
    }

    // Clone only if there was really a change
    let nextElementsSnapshot = this.elements;
    if (didElementsChange) {
      nextElementsSnapshot = this.createElementsSnapshot(elements);
    }

    const snapshot = new Snapshot(nextElementsSnapshot, nextAppStateSnapshot, {
      didElementsChange,
      didAppStateChange,
    });

    return snapshot;
  }

  /**
   * Detect if there any changed elements.
   *
   * NOTE: we shouldn't use `sceneVersionNonce` instead, as we need to call this before the scene updates.
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

  private detectChangedAppState(observedAppState: ObservedAppState) {
    return !isShallowEqual(this.appState, observedAppState, {
      selectedElementIds: isShallowEqual,
      selectedGroupIds: isShallowEqual,
    });
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
