import { ENV } from "./constants";
import { Emitter } from "./emitter";
import { randomId } from "./random";
import { getDefaultAppState } from "./appState";
import { AppStateDelta, Delta, ElementsDelta } from "./delta";
import { newElementWith } from "./element/mutateElement";
import { deepCopyElement } from "./element/newElement";
import type { AppState, ObservedAppState } from "./types";
import type { DTO, ValueOf } from "./utility-types";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "./element/types";
import type { SERVER_DELTA } from "./sync/protocol";
import { arrayToMap, assertNever } from "./utils";
import { hashElementsVersion } from "./element";
import { syncMovedIndices } from "./fractionalIndex";

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

// CFDO: consider adding a "remote" action, which should perform update but never be emitted (so that it we don't have to filter it when pushing it into sync api)
export const StoreAction = {
  /**
   * Immediately undoable.
   *
   * Use for updates which should be captured as durable deltas.
   * Should be used for most of the local updates (except ephemerals such as dragging or resizing).
   *
   * These updates will _immediately_ make it to the local undo / redo stacks.
   */
  CAPTURE: "CAPTURE_DELTA",
  /**
   * Never undoable.
   *
   * Use for updates which should never be captured as deltas, such as remote updates
   * or scene initialization.
   *
   * These updates will _never_ make it to the local undo / redo stacks.
   */
  UPDATE: "UPDATE_SNAPSHOT",
  /**
   * Eventually undoable.
   *
   * Use for updates which should not be captured as deltas immediately, such as
   * exceptions which are part of some async multi-step proces.
   *
   * These updates will be captured with the next `StoreAction.CAPTURE`,
   * triggered either by the next `updateScene` or internally by the editor.
   *
   * These updates will _eventually_ make it to the local undo / redo stacks.
   */
  // CFDO I: none is not really "none" anymore, as it at very least emits an ephemeral increment
  // we should likely rename these somehow and keep "none" only for real "no action" cases
  NONE: "NONE",
} as const;

export type StoreActionType = ValueOf<typeof StoreAction>;

/**
 * Store which captures the observed changes and emits them as `StoreIncrement` events.
 */
export class Store {
  public readonly onStoreIncrementEmitter = new Emitter<
    [DurableStoreIncrement | EphemeralStoreIncrement]
  >();

  private _snapshot = StoreSnapshot.empty();

  public get snapshot() {
    return this._snapshot;
  }

  public set snapshot(snapshot: StoreSnapshot) {
    this._snapshot = snapshot;
  }

  private scheduledActions: Set<StoreActionType> = new Set();

  public scheduleAction(action: StoreActionType) {
    this.scheduledActions.add(action);
    this.satisfiesScheduledActionsInvariant();
  }

  /**
   * Use to schedule a delta calculation, which will consquentially be emitted as `DurableStoreIncrement` and pushed in the undo stack.
   */
  // TODO: Suspicious that this is called so many places. Seems error-prone.
  public scheduleCapture() {
    this.scheduleAction(StoreAction.CAPTURE);
  }

  private get scheduledAction() {
    // Capture has a precedence over update, since it also performs snapshot update
    if (this.scheduledActions.has(StoreAction.CAPTURE)) {
      return StoreAction.CAPTURE;
    }

    // Update has a precedence over none, since it also emits an (ephemeral) increment
    if (this.scheduledActions.has(StoreAction.UPDATE)) {
      return StoreAction.UPDATE;
    }

    // CFDO: maybe it should be explicitly set so that we don't clone on every single component update
    // Emit ephemeral increment, don't update the snapshot
    return StoreAction.NONE;
  }

  /**
   * Performs the incoming `StoreAction` and emits the corresponding `StoreIncrement`.
   * Emits `DurableStoreIncrement` when action is "capture", emits `EphemeralStoreIncrement` otherwise.
   *
   * @emits StoreIncrement
   */
  public commit(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ): void {
    try {
      const { scheduledAction } = this;

      switch (scheduledAction) {
        case StoreAction.CAPTURE:
          this.snapshot = this.captureDurableIncrement(elements, appState);
          break;
        case StoreAction.UPDATE:
          this.snapshot = this.emitEphemeralIncrement(elements);
          break;
        case StoreAction.NONE:
          // ÇFDO: consider perf. optimisation without creating a snapshot if it is not updated in the end, it shall not be needed (more complex though)
          this.emitEphemeralIncrement(elements);
          return;
        default:
          assertNever(scheduledAction, `Unknown store action`);
      }
    } finally {
      this.satisfiesScheduledActionsInvariant();
      // Defensively reset all scheduled actions, potentially cleans up other runtime garbage
      this.scheduledActions = new Set();
    }
  }

  /**
   * Performs delta calculation and emits the increment.
   *
   * @emits StoreIncrement.
   */
  private captureDurableIncrement(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
  ) {
    const prevSnapshot = this.snapshot;
    const nextSnapshot = this.snapshot.maybeClone(elements, appState, {
      shouldIgnoreCache: true,
    });

    // Optimisation, don't continue if nothing has changed
    if (prevSnapshot === nextSnapshot) {
      return prevSnapshot;
    }
    // Calculate the deltas based on the previous and next snapshot
    const elementsDelta = nextSnapshot.metadata.didElementsChange
      ? ElementsDelta.calculate(prevSnapshot.elements, nextSnapshot.elements)
      : ElementsDelta.empty();

    const appStateDelta = nextSnapshot.metadata.didAppStateChange
      ? AppStateDelta.calculate(prevSnapshot.appState, nextSnapshot.appState)
      : AppStateDelta.empty();

    if (!elementsDelta.isEmpty() || !appStateDelta.isEmpty()) {
      const delta = StoreDelta.create(elementsDelta, appStateDelta);
      const change = StoreChange.create(prevSnapshot, nextSnapshot);
      const increment = new DurableStoreIncrement(change, delta);

      // Notify listeners with the increment
      this.onStoreIncrementEmitter.trigger(increment);
    }

    return nextSnapshot;
  }

  /**
   * When change is detected, emits an ephemeral increment and returns the next snapshot.
   *
   * @emits EphemeralStoreIncrement
   */
  private emitEphemeralIncrement(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
  ) {
    const prevSnapshot = this.snapshot;
    const nextSnapshot = this.snapshot.maybeClone(elements, undefined);

    if (prevSnapshot === nextSnapshot) {
      // nothing has changed
      return prevSnapshot;
    }

    const change = StoreChange.create(prevSnapshot, nextSnapshot);
    const increment = new EphemeralStoreIncrement(change);

    // Notify listeners with the increment
    // CFDO: consider having this async instead, possibly should also happen after the component updates;
    // or get rid of filtering local in progress elements, switch to unidirectional store flow and keep it synchronous
    this.onStoreIncrementEmitter.trigger(increment);

    return nextSnapshot;
  }

  /**
   * Filters out yet uncomitted elements from `nextElements`, which are part of in-progress local async actions (ephemerals) and thus were not yet commited to the snapshot.
   *
   * This is necessary in updates in which we receive reconciled elements, already containing elements which were not yet captured by the local store (i.e. collab).
   */
  public filterUncomittedElements(
    prevElements: Map<string, ExcalidrawElement>,
    nextElements: Map<string, ExcalidrawElement>,
  ): Map<string, OrderedExcalidrawElement> {
    const movedElements = new Map<string, ExcalidrawElement>();

    for (const [id, prevElement] of prevElements.entries()) {
      const nextElement = nextElements.get(id);

      if (!nextElement) {
        // Nothing to care about here, element was forcefully deleted
        continue;
      }

      const elementSnapshot = this.snapshot.elements.get(id);

      // Checks for in progress async user action
      if (!elementSnapshot) {
        // Detected yet uncomitted local element
        nextElements.delete(id);
      } else if (elementSnapshot.version < prevElement.version) {
        // Element was already commited, but the snapshot version is lower than current local version
        nextElements.set(id, elementSnapshot);
        // Mark the element as potentially moved, as it could have
        movedElements.set(id, elementSnapshot);
      }
    }

    // Make sure to sync only potentially invalid indices for all elements restored from the snapshot
    const syncedElements = syncMovedIndices(
      Array.from(nextElements.values()),
      movedElements,
    );

    return arrayToMap(syncedElements);
  }

  /**
   * Apply and emit increment.
   *
   * @emits StoreIncrement when increment is applied.
   */
  public applyDeltaTo(
    delta: StoreDelta,
    elements: SceneElementsMap,
    appState: AppState,
    options: {
      triggerIncrement: boolean;
      updateSnapshot: boolean;
    } = {
      triggerIncrement: false,
      updateSnapshot: false,
    },
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] = delta.elements.applyTo(
      elements,
      this.snapshot.elements,
    );

    const [nextAppState, appStateContainsVisibleChange] =
      delta.appState.applyTo(appState, nextElements);

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    const prevSnapshot = this.snapshot;
    const nextSnapshot = this.snapshot.maybeClone(nextElements, nextAppState, {
      shouldIgnoreCache: true,
    });

    if (options.triggerIncrement) {
      const change = StoreChange.create(prevSnapshot, nextSnapshot);
      const increment = new DurableStoreIncrement(change, delta);
      this.onStoreIncrementEmitter.trigger(increment);
    }

    // CFDO: maybe I should not update the snapshot here so that it always syncs ephemeral change after durable change,
    // so that clients exchange the latest element versions between each other,
    // meaning if it will be ignored on other clients, other clients would initiate a relay with current version instead of doing nothing
    if (options.updateSnapshot) {
      this.snapshot = nextSnapshot;
    }

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /**
   * Clears the store instance.
   */
  public clear(): void {
    this.snapshot = StoreSnapshot.empty();
    this.scheduledActions = new Set();
  }

  private satisfiesScheduledActionsInvariant() {
    if (
      !(
        this.scheduledActions.size >= 0 &&
        this.scheduledActions.size <= Object.keys(StoreAction).length
      )
    ) {
      const message = `There can be at most three store actions scheduled at the same time, but there are "${this.scheduledActions.size}".`;
      console.error(message, this.scheduledActions.values());

      if (import.meta.env.DEV || import.meta.env.MODE === ENV.TEST) {
        throw new Error(message);
      }
    }
  }
}

/**
 * Repsents a change to the store containg changed elements and appState.
 */
export class StoreChange {
  // CFDO: consider adding (observed & syncable) appState, though bare in mind that it's processed on every component update,
  // so figuring out what has changed should ideally be just quick reference checks
  private constructor(
    public readonly elements: Record<string, OrderedExcalidrawElement>,
  ) {}

  public static create(
    prevSnapshot: StoreSnapshot,
    nextSnapshot: StoreSnapshot,
  ) {
    const changedElements = nextSnapshot.getChangedElements(prevSnapshot);
    return new StoreChange(changedElements);
  }
}

/**
 * Encpasulates any change to the store (durable or ephemeral).
 */
export abstract class StoreIncrement {
  protected constructor(
    public readonly type: "durable" | "ephemeral",
    public readonly change: StoreChange,
  ) {}

  public static isDurable(
    increment: StoreIncrement,
  ): increment is DurableStoreIncrement {
    return increment.type === "durable";
  }

  public static isEphemeral(
    increment: StoreIncrement,
  ): increment is EphemeralStoreIncrement {
    return increment.type === "ephemeral";
  }
}

/**
 * Represents a durable change to the store.
 */
export class DurableStoreIncrement extends StoreIncrement {
  constructor(
    public readonly change: StoreChange,
    public readonly delta: StoreDelta,
  ) {
    super("durable", change);
  }
}

/**
 * Represents an ephemeral change to the store.
 */
export class EphemeralStoreIncrement extends StoreIncrement {
  constructor(public readonly change: StoreChange) {
    super("ephemeral", change);
  }
}

/**
 * Represents a captured delta by the Store.
 */
export class StoreDelta {
  protected constructor(
    public readonly id: string,
    public readonly elements: ElementsDelta,
    public readonly appState: AppStateDelta,
  ) {}

  /**
   * Create a new instance of `StoreDelta`.
   */
  public static create(
    elements: ElementsDelta,
    appState: AppStateDelta,
    opts: {
      id: string;
    } = {
      id: randomId(),
    },
  ) {
    return new this(opts.id, elements, appState);
  }

  /**
   * Restore a store delta instance from a DTO.
   */
  public static restore(storeDeltaDTO: DTO<StoreDelta>) {
    const { id, elements, appState } = storeDeltaDTO;
    return new this(
      id,
      ElementsDelta.restore(elements),
      AppStateDelta.restore(appState),
    );
  }

  /**
   * Parse and load the delta from the remote payload.
   */
  public static load({
    id,
    elements: { added, removed, updated },
  }: SERVER_DELTA["payload"]) {
    // CFDO: ensure typesafety
    const elements = ElementsDelta.create(added, removed, updated, {
      shouldRedistribute: false,
    });

    return new this(id, elements, AppStateDelta.empty());
  }

  /**
   * Inverse store delta, creates new instance of `StoreDelta`.
   */
  public static inverse(delta: StoreDelta): StoreDelta {
    return this.create(delta.elements.inverse(), delta.appState.inverse());
  }

  /**
   * Apply latest (remote) changes to the delta, creates new instance of `StoreDelta`.
   */
  public static applyLatestChanges(
    delta: StoreDelta,
    elements: SceneElementsMap,
  ): StoreDelta {
    const inversedDelta = this.inverse(delta);

    return this.create(
      inversedDelta.elements.applyLatestChanges(elements),
      inversedDelta.appState,
      {
        id: inversedDelta.id,
      },
    );
  }

  public isEmpty() {
    return this.elements.isEmpty() && this.appState.isEmpty();
  }
}

/**
 * Represents a snapshot of the captured or updated changes in the store,
 * used for producing deltas and emitting `DurableStoreIncrement`s.
 */
export class StoreSnapshot {
  private _lastChangedElementsHash: number = 0;

  private constructor(
    public readonly elements: Map<string, OrderedExcalidrawElement>,
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

  public static empty() {
    return new StoreSnapshot(
      new Map(),
      getObservedAppState(getDefaultAppState() as AppState),
      { didElementsChange: false, didAppStateChange: false, isEmpty: true },
    );
  }

  public getChangedElements(prevSnapshot: StoreSnapshot) {
    const changedElements: Record<string, OrderedExcalidrawElement> = {};

    for (const [id, nextElement] of this.elements.entries()) {
      // Due to the structural clone inside `maybeClone`, we can perform just these reference checks
      if (prevSnapshot.elements.get(id) !== nextElement) {
        changedElements[id] = nextElement;
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
   * Efficiently clone the existing snapshot, only if we detected changes.
   *
   * @returns same instance if there are no changes detected, new instance otherwise.
   */
  public maybeClone(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
    options: {
      shouldIgnoreCache: boolean;
    } = {
      shouldIgnoreCache: false,
    },
  ) {
    const nextElementsSnapshot = this.maybeCreateElementsSnapshot(
      elements,
      options,
    );
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
    // CFDO: could we optimize by checking only reference changes? (i.e. selectedElementIds should be stable now)
    return Delta.isRightDifferent(this.appState, nextObservedAppState);
  }

  private maybeCreateElementsSnapshot(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    options: {
      shouldIgnoreCache: boolean;
    } = {
      shouldIgnoreCache: false,
    },
  ) {
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

  /**
   * Detect if there any changed elements.
   *
   * NOTE: we shouldn't just use `sceneVersionNonce` instead, as we need to call this before the scene updates.
   */
  private detectChangedElements(
    nextElements: Map<string, OrderedExcalidrawElement>,
    options: {
      shouldIgnoreCache: boolean;
    } = {
      shouldIgnoreCache: false,
    },
  ) {
    if (this.elements === nextElements) {
      return;
    }

    const changedElements: Map<string, OrderedExcalidrawElement> = new Map();

    for (const [id, prevElement] of this.elements) {
      const nextElement = nextElements.get(id);

      if (!nextElement) {
        // element was deleted
        changedElements.set(
          id,
          newElementWith(prevElement, { isDeleted: true }),
        );
      }
    }

    for (const [id, nextElement] of nextElements) {
      const prevElement = this.elements.get(id);

      if (
        !prevElement || // element was added
        prevElement.version < nextElement.version // element was updated
      ) {
        changedElements.set(id, nextElement);
      }
    }

    if (!changedElements.size) {
      return;
    }

    // if we wouldn't ignore a cache, durable increment would be skipped
    // in case there was an ephemeral increment emitter just before
    // with the same changed elements
    if (options.shouldIgnoreCache) {
      return changedElements;
    }

    // due to snapshot containing only durable changes,
    // we might have already processed these elements in a previous run,
    // hence additionally check whether the hash of the elements has changed
    // since if it didn't, we don't need to process them again
    // otherwise we would have ephemeral increments even for component updates unrelated to elements
    const changedElementsHash = hashElementsVersion(
      Array.from(changedElements.values()),
    );

    if (this._lastChangedElementsHash === changedElementsHash) {
      return;
    }

    this._lastChangedElementsHash = changedElementsHash;
    return changedElements;
  }

  /**
   * Perform structural clone, deep cloning only elements that changed.
   */
  private createElementsSnapshot(
    changedElements: Map<string, OrderedExcalidrawElement>,
  ) {
    const clonedElements = new Map();

    for (const [id, prevElement] of this.elements) {
      // Clone previous elements, never delete, in case nextElements would be just a subset of previous elements
      // i.e. during collab, persist or whenenever isDeleted elements get cleared
      clonedElements.set(id, prevElement);
    }

    for (const [id, changedElement] of changedElements) {
      clonedElements.set(id, deepCopyElement(changedElement));
    }

    return clonedElements;
  }
}
