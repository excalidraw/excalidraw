import { Emitter } from "./emitter";

import type { AppStateChange, ElementsChange } from "./change";
import type { SceneElementsMap } from "./element/types";
import type { Snapshot } from "./store";
import type { AppState } from "./types";

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

  private readonly undoStack: HistoryStack = [];
  private readonly redoStack: HistoryStack = [];

  public get isUndoStackEmpty() {
    return this.undoStack.length === 0;
  }

  public get isRedoStackEmpty() {
    return this.redoStack.length === 0;
  }

  public clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /**
   * Record a local change which will go into the history
   */
  public record(
    elementsChange: ElementsChange,
    appStateChange: AppStateChange,
  ) {
    const entry = HistoryEntry.create(appStateChange, elementsChange);

    if (!entry.isEmpty()) {
      // we have the latest changes, no need to `applyLatest`, which is done within `History.push`
      this.undoStack.push(entry.inverse());

      if (!entry.elementsChange.isEmpty()) {
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

  public undo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ) {
    return this.perform(
      elements,
      appState,
      snapshot,
      () => History.pop(this.undoStack),
      (entry: HistoryEntry) => History.push(this.redoStack, entry, elements),
    );
  }

  public redo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ) {
    return this.perform(
      elements,
      appState,
      snapshot,
      () => History.pop(this.redoStack),
      (entry: HistoryEntry) => History.push(this.undoStack, entry, elements),
    );
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
    pop: () => HistoryEntry | null,
    push: (entry: HistoryEntry) => void,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyEntry = pop();

      if (historyEntry === null) {
        return;
      }

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyEntry) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            historyEntry.applyTo(nextElements, nextAppState, snapshot);
        } finally {
          // make sure to always push / pop, even if the increment is corrupted
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
    const updatedEntry = entry.inverse().applyLatestChanges(prevElements);
    return stack.push(updatedEntry);
  }
}

export class HistoryEntry {
  private constructor(
    public readonly appStateChange: AppStateChange,
    public readonly elementsChange: ElementsChange,
  ) {}

  public static create(
    appStateChange: AppStateChange,
    elementsChange: ElementsChange,
  ) {
    return new HistoryEntry(appStateChange, elementsChange);
  }

  public inverse(): HistoryEntry {
    return new HistoryEntry(
      this.appStateChange.inverse(),
      this.elementsChange.inverse(),
    );
  }

  public applyTo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] =
      this.elementsChange.applyTo(elements, snapshot.elements);

    const [nextAppState, appStateContainsVisibleChange] =
      this.appStateChange.applyTo(appState, nextElements);

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /**
   * Apply latest (remote) changes to the history entry, creates new instance of `HistoryEntry`.
   */
  public applyLatestChanges(elements: SceneElementsMap): HistoryEntry {
    const updatedElementsChange =
      this.elementsChange.applyLatestChanges(elements);

    return HistoryEntry.create(this.appStateChange, updatedElementsChange);
  }

  public isEmpty(): boolean {
    return this.appStateChange.isEmpty() && this.elementsChange.isEmpty();
  }
}
