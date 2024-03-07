import { AppStateChange, ElementsChange } from "./change";
import { SceneElementsMap } from "./element/types";
import { Emitter } from "./emitter";
import { Snapshot } from "./store";
import { AppState } from "./types";

export class HistoryChangedEvent {
  constructor(
    public readonly isUndoStackEmpty: boolean,
    public readonly isRedoStackEmpty: boolean,
  ) {}
}

export class History {
  public readonly onHistoryChangeEmitter = new Emitter<[HistoryChangedEvent]>();

  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];

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
      this.undoStack.push(entry);

      // As a new entry was pushed, we invalidate the redo stack
      this.redoStack.length = 0;
      this.onHistoryChangeEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  public undo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ) {
    return this.perform(this.undoOnce.bind(this), elements, appState, snapshot);
  }

  public redo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ) {
    return this.perform(this.redoOnce.bind(this), elements, appState, snapshot);
  }

  private perform(
    action: typeof this.undoOnce | typeof this.redoOnce,
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ): [SceneElementsMap, AppState] | void {
    let historyEntry = action(elements);

    this.onHistoryChangeEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );

    // Nothing to undo / redo
    if (historyEntry === null) {
      return;
    }

    let nextElements = elements;
    let nextAppState = appState;
    let containsVisibleChange = false;

    // Iterate through the history entries in case they result in no visible changes
    while (historyEntry) {
      [nextElements, nextAppState, containsVisibleChange] =
        historyEntry.applyTo(nextElements, nextAppState, snapshot);

      if (containsVisibleChange) {
        break;
      }

      historyEntry = action(elements);
    }

    return [nextElements, nextAppState];
  }

  private undoOnce(elements: SceneElementsMap): HistoryEntry | null {
    if (!this.undoStack.length) {
      return null;
    }

    const undoEntry = this.undoStack.pop();

    if (undoEntry !== undefined) {
      const redoEntry = undoEntry.applyLatestChanges(elements, "inserted");
      this.redoStack.push(redoEntry);

      return undoEntry.inverse();
    }

    return null;
  }

  private redoOnce(elements: SceneElementsMap): HistoryEntry | null {
    if (!this.redoStack.length) {
      return null;
    }

    const redoEntry = this.redoStack.pop();

    if (redoEntry !== undefined) {
      const undoEntry = redoEntry.applyLatestChanges(elements, "deleted");
      this.undoStack.push(undoEntry);

      return redoEntry;
    }

    return null;
  }
}

export class HistoryEntry {
  private constructor(
    private readonly appStateChange: AppStateChange,
    private readonly elementsChange: ElementsChange,
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
  public applyLatestChanges(
    elements: SceneElementsMap,
    modifierOptions: "deleted" | "inserted",
  ): HistoryEntry {
    const updatedElementsChange = this.elementsChange.applyLatestChanges(
      elements,
      modifierOptions,
    );

    return HistoryEntry.create(this.appStateChange, updatedElementsChange);
  }

  public isEmpty(): boolean {
    return this.appStateChange.isEmpty() && this.elementsChange.isEmpty();
  }
}
