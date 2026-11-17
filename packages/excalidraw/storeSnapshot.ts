// Snapshots of the scene and observed app state that the store diffs into deltas.

import { toIterable } from "@excalidraw/common";
import {
  deepCopyElement,
  newElementWith,
  hashElementsVersion,
  hashString,
  isInitializedImageElement,
  isImageElement,
} from "@excalidraw/element";

import { COLOR_PALETTE } from "@excalidraw/common";

import type {
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import { Delta } from "./deltaBase";

import { CaptureUpdateAction } from "./captureUpdate";

import type { CaptureUpdateActionType } from "./captureUpdate";
import type { StoreChange } from "./store";

import type { AppState, ObservedAppState } from "./types";

/**
 * Represents a snapshot of the captured or updated changes in the store,
 * used for producing deltas and emitting `DurableStoreIncrement`s.
 */
export class StoreSnapshot {
  private _lastChangedElementsHash: number = 0;
  private _lastChangedAppStateHash: number = 0;

  private constructor(
    public readonly elements: SceneElementsMap,
    public readonly appState: ObservedAppState,
    public readonly metadata: {
      didElementsChange: boolean;
      didAppStateChange: boolean;
      isEmpty?: boolean;
    } = {
      didElementsChange: false,
      didAppStateChange: false,
      isEmpty: false,
    },
  ) {}

  public static create(
    elements: SceneElementsMap,
    appState: AppState | ObservedAppState,
    metadata: {
      didElementsChange: boolean;
      didAppStateChange: boolean;
    } = {
      didElementsChange: false,
      didAppStateChange: false,
    },
  ) {
    return new StoreSnapshot(
      elements,
      isObservedAppState(appState) ? appState : getObservedAppState(appState),
      metadata,
    );
  }

  public static empty() {
    return new StoreSnapshot(
      new Map() as SceneElementsMap,
      getDefaultObservedAppState(),
      {
        didElementsChange: false,
        didAppStateChange: false,
        isEmpty: true,
      },
    );
  }

  public getChangedElements(prevSnapshot: StoreSnapshot) {
    const changedElements: Record<string, OrderedExcalidrawElement> = {};

    for (const prevElement of toIterable(prevSnapshot.elements)) {
      const nextElement = this.elements.get(prevElement.id);

      if (!nextElement) {
        changedElements[prevElement.id] = newElementWith(prevElement, {
          isDeleted: true,
        });
      }
    }

    for (const nextElement of toIterable(this.elements)) {
      // Due to the structural clone inside `maybeClone`, we can perform just these reference checks
      if (prevSnapshot.elements.get(nextElement.id) !== nextElement) {
        changedElements[nextElement.id] = nextElement;
      }
    }

    return changedElements;
  }

  public getChangedAppState(
    prevSnapshot: StoreSnapshot,
  ): Partial<ObservedAppState> {
    return Delta.getRightDifferences(
      prevSnapshot.appState,
      this.appState,
    ).reduce(
      (acc, key) =>
        Object.assign(acc, {
          [key]: this.appState[key as keyof ObservedAppState],
        }),
      {} as Partial<ObservedAppState>,
    );
  }

  public isEmpty() {
    return this.metadata.isEmpty;
  }

  /**
   * Apply the change and return a new snapshot instance.
   */
  public applyChange(change: StoreChange): StoreSnapshot {
    const nextElements = new Map(this.elements) as SceneElementsMap;

    for (const [id, changedElement] of Object.entries(change.elements)) {
      nextElements.set(id, changedElement);
    }

    const nextAppState = getObservedAppState({
      ...this.appState,
      ...change.appState,
    });

    return StoreSnapshot.create(nextElements, nextAppState, {
      // by default we assume that change is different from what we have in the snapshot
      // so that we trigger the delta calculation and if it isn't different, delta will be empty
      didElementsChange: Object.keys(change.elements).length > 0,
      didAppStateChange: Object.keys(change.appState).length > 0,
    });
  }

  /**
   * Efficiently clone the existing snapshot, only if we detected changes.
   *
   * @returns same instance if there are no changes detected, new instance otherwise.
   */
  public maybeClone(
    action: CaptureUpdateActionType,
    elements: SceneElementsMap | undefined,
    appState: AppState | ObservedAppState | undefined,
  ) {
    const options = {
      shouldCompareHashes: false,
    };

    if (action === CaptureUpdateAction.EVENTUALLY) {
      // actions that do not update the snapshot immediately, must be additionally checked for changes against the latest hash
      // as we are always comparing against the latest snapshot, so they would emit elements or appState as changed on every component update
      // instead of just the first time the elements or appState actually changed
      options.shouldCompareHashes = true;
    }

    const nextElementsSnapshot = this.maybeCreateElementsSnapshot(
      elements,
      options,
    );
    const nextAppStateSnapshot = this.maybeCreateAppStateSnapshot(
      appState,
      options,
    );

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

    const snapshot = new StoreSnapshot(
      nextElementsSnapshot,
      nextAppStateSnapshot,
      {
        didElementsChange,
        didAppStateChange,
      },
    );

    return snapshot;
  }

  private maybeCreateAppStateSnapshot(
    appState: AppState | ObservedAppState | undefined,
    options: {
      shouldCompareHashes: boolean;
    } = {
      shouldCompareHashes: false,
    },
  ): ObservedAppState {
    if (!appState) {
      return this.appState;
    }

    // Not watching over everything from the app state, just the relevant props
    const nextAppStateSnapshot = !isObservedAppState(appState)
      ? getObservedAppState(appState)
      : appState;

    const didAppStateChange = this.detectChangedAppState(
      nextAppStateSnapshot,
      options,
    );

    if (!didAppStateChange) {
      return this.appState;
    }

    return nextAppStateSnapshot;
  }

  private maybeCreateElementsSnapshot(
    elements: SceneElementsMap | undefined,
    options: {
      shouldCompareHashes: boolean;
    } = {
      shouldCompareHashes: false,
    },
  ): SceneElementsMap {
    if (!elements) {
      return this.elements;
    }

    const changedElements = this.detectChangedElements(elements, options);

    if (!changedElements?.size) {
      return this.elements;
    }

    const elementsSnapshot = this.createElementsSnapshot(changedElements);
    return elementsSnapshot;
  }

  private detectChangedAppState(
    nextObservedAppState: ObservedAppState,
    options: {
      shouldCompareHashes: boolean;
    } = {
      shouldCompareHashes: false,
    },
  ): boolean | undefined {
    if (this.appState === nextObservedAppState) {
      return;
    }

    const didAppStateChange = Delta.isRightDifferent(
      this.appState,
      nextObservedAppState,
    );

    if (!didAppStateChange) {
      return;
    }

    const changedAppStateHash = hashString(
      JSON.stringify(nextObservedAppState),
    );

    if (
      options.shouldCompareHashes &&
      this._lastChangedAppStateHash === changedAppStateHash
    ) {
      return;
    }

    this._lastChangedAppStateHash = changedAppStateHash;

    return didAppStateChange;
  }

  /**
   * Detect if there are any changed elements.
   */
  private detectChangedElements(
    nextElements: SceneElementsMap,
    options: {
      shouldCompareHashes: boolean;
    } = {
      shouldCompareHashes: false,
    },
  ): SceneElementsMap | undefined {
    if (this.elements === nextElements) {
      return;
    }

    const changedElements: SceneElementsMap = new Map() as SceneElementsMap;

    for (const prevElement of toIterable(this.elements)) {
      const nextElement = nextElements.get(prevElement.id);

      if (!nextElement) {
        // element was deleted
        changedElements.set(
          prevElement.id,
          newElementWith(prevElement, { isDeleted: true }),
        );
      }
    }

    for (const nextElement of toIterable(nextElements)) {
      const prevElement = this.elements.get(nextElement.id);

      if (
        !prevElement || // element was added
        prevElement.version < nextElement.version // element was updated
      ) {
        if (
          isImageElement(nextElement) &&
          !isInitializedImageElement(nextElement)
        ) {
          // ignore any updates on uninitialized image elements
          continue;
        }

        changedElements.set(nextElement.id, nextElement);
      }
    }

    if (!changedElements.size) {
      return;
    }

    const changedElementsHash = hashElementsVersion(changedElements);

    if (
      options.shouldCompareHashes &&
      this._lastChangedElementsHash === changedElementsHash
    ) {
      return;
    }

    this._lastChangedElementsHash = changedElementsHash;

    return changedElements;
  }

  /**
   * Perform structural clone, deep cloning only elements that changed.
   */
  private createElementsSnapshot(changedElements: SceneElementsMap) {
    const clonedElements = new Map() as SceneElementsMap;

    for (const prevElement of toIterable(this.elements)) {
      // Clone previous elements, never delete, in case nextElements would be just a subset of previous elements
      // i.e. during collab, persist or whenenever isDeleted elements get cleared
      clonedElements.set(prevElement.id, prevElement);
    }

    for (const changedElement of toIterable(changedElements)) {
      // TODO: consider just creating new instance, once we can ensure that all reference properties on every element are immutable
      // TODO: consider creating a lazy deep clone, having a one-time-usage proxy over the snapshotted element and deep cloning only if it gets mutated
      clonedElements.set(changedElement.id, deepCopyElement(changedElement));
    }

    return clonedElements;
  }
}

export const getObservedAppState = (
  appState: AppState | ObservedAppState,
): ObservedAppState => {
  const observedAppState = {
    name: appState.name,
    editingGroupId: appState.editingGroupId,
    viewBackgroundColor: appState.viewBackgroundColor,
    selectedElementIds: appState.selectedElementIds,
    selectedGroupIds: appState.selectedGroupIds,
    croppingElementId: appState.croppingElementId,
    activeLockedId: appState.activeLockedId,
    lockedMultiSelections: appState.lockedMultiSelections,
    selectedLinearElement: appState.selectedLinearElement
      ? {
          elementId: appState.selectedLinearElement.elementId,
          isEditing: !!appState.selectedLinearElement.isEditing,
        }
      : null,
  };

  Reflect.defineProperty(observedAppState, hiddenObservedAppStateProp, {
    value: true,
    enumerable: false,
  });

  return observedAppState;
};

// hidden non-enumerable property for runtime checks
const hiddenObservedAppStateProp = "__observedAppState";

const getDefaultObservedAppState = (): ObservedAppState => {
  return {
    name: null,
    editingGroupId: null,
    viewBackgroundColor: COLOR_PALETTE.white,
    selectedElementIds: {},
    selectedGroupIds: {},
    selectedLinearElement: null,
    croppingElementId: null,
    activeLockedId: null,
    lockedMultiSelections: {},
  };
};

const isObservedAppState = (
  appState: AppState | ObservedAppState,
): appState is ObservedAppState =>
  !!Reflect.get(appState, hiddenObservedAppStateProp);
