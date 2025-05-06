import { Emitter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
  type Store,
} from "@excalidraw/element/store";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { AppState } from "./types";

class HistoryEntry extends StoreDelta {}

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

  public readonly undoStack: HistoryEntry[] = [];
  public readonly redoStack: HistoryEntry[] = [];

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
   * Record a non-empty local durable increment, which will go into the undo stack..
   * Do not re-record history entries, which were already pushed to undo / redo stack, as part of history action.
   */
  public record(delta: StoreDelta) {
    if (delta.isEmpty() || delta instanceof HistoryEntry) {
      return;
    }

    // construct history entry, so once it's emitted, it's not recorded again
    const entry = HistoryEntry.inverse(delta);

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

      const action = CaptureUpdateAction.IMMEDIATELY;

      let prevSnapshot = this.store.snapshot;

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyEntry) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            StoreDelta.applyTo(
              historyEntry,
              nextElements,
              nextAppState,
              prevSnapshot,
            );

          const nextSnapshot = prevSnapshot.maybeClone(
            action,
            nextElements,
            nextAppState,
          );

          // schedule immediate capture, so that it's emitted for the sync purposes
          this.store.scheduleMicroAction({
            action,
            change: StoreChange.create(prevSnapshot, nextSnapshot),
            delta: historyEntry,
          });

          prevSnapshot = nextSnapshot;
        } finally {
          // make sure to always push, even if the delta is corrupted
          push(historyEntry);
        }

        if (containsVisibleChange) {
          break;
        }

        historyEntry = pop();
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

  private static pop(stack: HistoryEntry[]): HistoryEntry | null {
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
    stack: HistoryEntry[],
    entry: HistoryEntry,
    prevElements: SceneElementsMap,
  ) {
    const inversedEntry = HistoryEntry.inverse(entry);
    const updatedEntry = HistoryEntry.applyLatestChanges(
      inversedEntry,
      prevElements,
      "inserted",
    );

    return stack.push(updatedEntry);
  }
}
