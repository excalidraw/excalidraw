import { Emitter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
} from "@excalidraw/element";

import type {
  RenderEnvironment,
  StoreSnapshot,
  Store,
} from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { AppState } from "./types";

const isGone = (elements: SceneElementsMap, id: string) => {
  const element = elements.get(id);
  return !element || element.isDeleted;
};

export class HistoryDelta extends StoreDelta {
  /**
   * Apply the delta to the passed elements and appState, does not modify the snapshot.
   */
  public applyTo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: StoreSnapshot,
    /** measures the labels re-laid out after applying */
    renderEnvironment?: RenderEnvironment,
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] = this.elements.applyTo(
      elements,
      // used to fallback into local snapshot in case we couldn't apply the delta
      // due to a missing (force deleted) elements in the scene
      snapshot.elements,
      // we don't want to apply the `version` and `versionNonce` properties for history
      // as we always need to end up with a new version due to collaboration,
      // approaching each undo / redo as a new user action
      {
        excludedProperties: new Set(["version", "versionNonce"]),
        renderEnvironment,
      },
    );

    const [nextAppState, appStateContainsVisibleChange] = this.appState.applyTo(
      appState,
      nextElements,
    );

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /** The ids of the elements the delta touches. */
  public getElementIds() {
    const { added, removed, updated } = this.elements;

    return [
      ...Object.keys(added),
      ...Object.keys(removed),
      ...Object.keys(updated),
    ];
  }

  /**
   * Whether there is nothing left for the delta to act on: all it touches is
   * gone from the scene, it brings nothing back and it changes no visible
   * appState. Only tells of the scene as it is, as an entry further up the
   * stack can bring an element back for this one.
   */
  public isStale(elements: SceneElementsMap, appState: AppState) {
    return (
      !Object.keys(this.elements.added).length &&
      this.getElementIds().every((id) => isGone(elements, id)) &&
      !this.appState.applyTo(appState, elements)[1]
    );
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override calculate(
    prevSnapshot: StoreSnapshot,
    nextSnapshot: StoreSnapshot,
  ) {
    return super.calculate(prevSnapshot, nextSnapshot) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override inverse(delta: StoreDelta): HistoryDelta {
    return super.inverse(delta) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override applyLatestChanges(
    delta: StoreDelta,
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
    modifierOptions?: "deleted" | "inserted",
  ) {
    return super.applyLatestChanges(
      delta,
      prevElements,
      nextElements,
      modifierOptions,
    ) as HistoryDelta;
  }
}

export class HistoryChangedEvent {
  constructor(
    public readonly isUndoStackEmpty: boolean = true,
    public readonly isRedoStackEmpty: boolean = true,
  ) {}
}

export class History {
  public readonly onHistoryChangedEmitter = new Emitter<
    [HistoryChangedEvent]
  >();

  public readonly undoStack: HistoryDelta[] = [];
  public readonly redoStack: HistoryDelta[] = [];

  /**
   * The elements a host declared gone through `prune`. Undo / redo drop the
   * entries they uncover on these, and on these only: elsewhere an entry that
   * can't act now can still be brought back to life, i.e. by a collaborator.
   */
  private readonly prunedElementIds = new Set<string>();

  public get isUndoStackEmpty() {
    return this.undoStack.length === 0;
  }

  public get isRedoStackEmpty() {
    return this.redoStack.length === 0;
  }

  constructor(private readonly store: Store) {}

  public clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.prunedElementIds.clear();
  }

  /**
   * Record a non-empty local durable increment, which will go into the undo stack..
   * Do not re-record history entries, which were already pushed to undo / redo stack, as part of history action.
   */
  public record(delta: StoreDelta) {
    if (delta.isEmpty() || delta instanceof HistoryDelta) {
      return;
    }

    // construct history entry, so once it's emitted, it's not recorded again
    const historyDelta = HistoryDelta.inverse(delta);

    this.undoStack.push(historyDelta);

    if (!historyDelta.elements.isEmpty()) {
      // don't reset redo stack on local appState changes,
      // as a simple click (unselect) could lead to losing all the redo entries
      // only reset on non empty elements changes!
      this.redoStack.length = 0;
    }

    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  /**
   * Drops the entries on top of the undo and redo stacks that have nothing
   * left to act on, the ones an undo / redo would skip without showing
   * anything: else they stay enabled with nothing to do. Stops at the first
   * entry that can still act, as it can bring back what the entries below it
   * touch. The ones below are dropped once an undo / redo uncovers them.
   *
   * Not for collaboration: a collaborator can restore an element, and its
   * entries are live again then.
   */
  public prune(elements: SceneElementsMap, appState: AppState) {
    for (const entry of [...this.undoStack, ...this.redoStack]) {
      for (const id of entry.getElementIds()) {
        if (isGone(elements, id)) {
          this.prunedElementIds.add(id);
        } else {
          this.prunedElementIds.delete(id);
        }
      }
    }

    if (this.dropStaleEntries(elements, appState)) {
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private dropStaleEntries(elements: SceneElementsMap, appState: AppState) {
    if (!this.prunedElementIds.size) {
      return false;
    }

    const isDroppable = (entry: HistoryDelta | undefined) =>
      entry?.isStale(elements, appState) &&
      entry.getElementIds().every((id) => this.prunedElementIds.has(id));

    let dropped = false;

    for (const stack of [this.undoStack, this.redoStack]) {
      while (isDroppable(stack.at(-1))) {
        stack.pop();
        dropped = true;
      }
    }

    return dropped;
  }

  public undo(
    elements: SceneElementsMap,
    appState: AppState,
    /** measures the labels re-laid out after undoing (the host's, in the editor) */
    renderEnvironment?: RenderEnvironment,
  ) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.undoStack),
      (entry: HistoryDelta) => History.push(this.redoStack, entry),
      renderEnvironment,
    );
  }

  public redo(
    elements: SceneElementsMap,
    appState: AppState,
    /** measures the labels re-laid out after redoing (the host's, in the editor) */
    renderEnvironment?: RenderEnvironment,
  ) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.redoStack),
      (entry: HistoryDelta) => History.push(this.undoStack, entry),
      renderEnvironment,
    );
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    pop: () => HistoryDelta | null,
    push: (entry: HistoryDelta) => void,
    renderEnvironment: RenderEnvironment | undefined,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyDelta = pop();

      if (historyDelta === null) {
        return;
      }

      const action = CaptureUpdateAction.IMMEDIATELY;

      let prevSnapshot = this.store.snapshot;

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyDelta) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            historyDelta.applyTo(
              nextElements,
              nextAppState,
              prevSnapshot,
              renderEnvironment,
            );

          const prevElements = prevSnapshot.elements;
          const nextSnapshot = prevSnapshot.maybeClone(
            action,
            nextElements,
            nextAppState,
          );

          const change = StoreChange.create(prevSnapshot, nextSnapshot);
          const delta = HistoryDelta.applyLatestChanges(
            historyDelta,
            prevElements,
            nextElements,
          );

          if (!delta.isEmpty()) {
            // schedule immediate capture, so that it's emitted for the sync purposes
            this.store.scheduleMicroAction({
              action,
              change,
              delta,
            });

            historyDelta = delta;
          }

          prevSnapshot = nextSnapshot;
        } finally {
          push(historyDelta);
        }

        if (containsVisibleChange) {
          break;
        }

        historyDelta = pop();
      }

      this.dropStaleEntries(nextElements, nextAppState);

      return [nextElements, nextAppState];
    } finally {
      // trigger the history change event before returning completely
      // also trigger it just once, no need doing so on each entry
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private static pop(stack: HistoryDelta[]): HistoryDelta | null {
    if (!stack.length) {
      return null;
    }

    const entry = stack.pop();

    if (entry !== undefined) {
      return entry;
    }

    return null;
  }

  private static push(stack: HistoryDelta[], entry: HistoryDelta) {
    const inversedEntry = HistoryDelta.inverse(entry);
    return stack.push(inversedEntry);
  }
}
