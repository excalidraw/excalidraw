import { Emitter } from "./emitter";
import { type Store, StoreDelta, StoreIncrement } from "./store";
import type { SceneElementsMap } from "./element/types";
import type { AppState } from "./types";

export class HistoryEntry extends StoreDelta {}

type HistoryStack = HistoryEntry[];

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

  public readonly undoStack: HistoryStack = [];
  public readonly redoStack: HistoryStack = [];

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
  }

  /**
   * Record a local change which will go into the history
   */
  public record(increment: StoreIncrement) {
    if (
      StoreIncrement.isDurable(increment) &&
      !increment.delta.isEmpty() &&
      !(increment.delta instanceof HistoryEntry)
    ) {
      // construct history entry, so once it's emitted, it's not recorded again
      const entry = HistoryEntry.inverse(increment.delta);

      this.undoStack.push(entry);

      if (!entry.elements.isEmpty()) {
        // don't reset redo stack on local appState changes,
        // as a simple click (unselect) could lead to losing all the redo entries
        // only reset on non empty elements changes!
        this.redoStack.length = 0;
      }

      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  public undo(elements: SceneElementsMap, appState: AppState) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.undoStack),
      (entry: HistoryEntry) => History.push(this.redoStack, entry, elements),
    );
  }

  public redo(elements: SceneElementsMap, appState: AppState) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.redoStack),
      (entry: HistoryEntry) => History.push(this.undoStack, entry, elements),
    );
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    pop: () => HistoryEntry | null,
    push: (entry: HistoryEntry) => void,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyEntry = pop();

      if (historyEntry === null) {
        return;
      }

      let prevSnapshot = this.store.snapshot;
      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyEntry) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            this.store.applyDeltaTo(historyEntry, nextElements, nextAppState, {
              triggerIncrement: true,
            });

          prevSnapshot = this.store.snapshot;
        } catch (e) {
          console.error("Failed to apply history entry:", e);
          // rollback to the previous snapshot, so that we don't end up in an incosistent state
          this.store.snapshot = prevSnapshot;
        } finally {
          // make sure to always push, even if the delta is corrupted
          push(historyEntry);
        }

        if (containsVisibleChange) {
          break;
        }

        historyEntry = pop();
      }

      if (nextElements === null || nextAppState === null) {
        return;
      }

      return [nextElements, nextAppState];
    } finally {
      // trigger the history change event before returning completely
      // also trigger it just once, no need doing so on each entry
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private static pop(stack: HistoryStack): HistoryEntry | null {
    if (!stack.length) {
      return null;
    }

    const entry = stack.pop();

    if (entry !== undefined) {
      return entry;
    }

    return null;
  }

  private static push(
    stack: HistoryStack,
    entry: HistoryEntry,
    prevElements: SceneElementsMap,
  ) {
    const updatedEntry = HistoryEntry.applyLatestChanges(entry, prevElements);
    return stack.push(updatedEntry);
  }
}
