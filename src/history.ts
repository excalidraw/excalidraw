import { AppState } from "./types";
import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";
import { isLinearElement } from "./element/typeChecks";

export type HistoryEntry = {
  appState: ReturnType<typeof clearAppStatePropertiesForHistory>;
  elements: ExcalidrawElement[];
};

type HistoryEntrySerialized = string;

const clearAppStatePropertiesForHistory = (appState: AppState) => {
  return {
    selectedElementIds: appState.selectedElementIds,
    viewBackgroundColor: appState.viewBackgroundColor,
    name: appState.name,
  };
};

export class SceneHistory {
  private recording: boolean = true;
  private stateHistory: HistoryEntrySerialized[] = [];
  private redoStack: HistoryEntrySerialized[] = [];
  private lastEntry: HistoryEntry | null = null;

  getSnapshotForTest() {
    return {
      recording: this.recording,
      stateHistory: this.stateHistory.map((s) => JSON.parse(s)),
      redoStack: this.redoStack.map((s) => JSON.parse(s)),
    };
  }

  clear() {
    this.stateHistory.length = 0;
    this.redoStack.length = 0;
    this.lastEntry = null;
  }

  private parseEntry(
    entrySerialized: HistoryEntrySerialized | undefined,
  ): HistoryEntry | null {
    if (entrySerialized === undefined) {
      return null;
    }
    try {
      return JSON.parse(entrySerialized);
    } catch {
      return null;
    }
  }

  private generateEntry = (
    appState: AppState,
    elements: readonly ExcalidrawElement[],
  ) =>
    JSON.stringify({
      appState: clearAppStatePropertiesForHistory(appState),
      elements: elements.reduce((elements, element) => {
        if (
          isLinearElement(element) &&
          appState.multiElement &&
          appState.multiElement.id === element.id
        ) {
          // don't store multi-point arrow if still has only one point
          if (
            appState.multiElement &&
            appState.multiElement.id === element.id &&
            element.points.length < 2
          ) {
            return elements;
          }

          elements.push({
            ...element,
            // don't store last point if not committed
            points:
              element.lastCommittedPoint !==
              element.points[element.points.length - 1]
                ? element.points.slice(0, -1)
                : element.points,
          });
        } else {
          elements.push(element);
        }
        return elements;
      }, [] as Mutable<typeof elements>),
    });

  shouldCreateEntry(nextEntry: HistoryEntry): boolean {
    const { lastEntry } = this;

    if (!lastEntry) {
      return true;
    }

    if (nextEntry.elements.length !== lastEntry.elements.length) {
      return true;
    }

    // loop from right to left as changes are likelier to happen on new elements
    for (let i = nextEntry.elements.length - 1; i > -1; i--) {
      const prev = nextEntry.elements[i];
      const next = lastEntry.elements[i];
      if (
        !prev ||
        !next ||
        prev.id !== next.id ||
        prev.version !== next.version ||
        prev.versionNonce !== next.versionNonce
      ) {
        return true;
      }
    }

    // note: this is safe because entry's appState is guaranteed no excess props
    let key: keyof typeof nextEntry.appState;
    for (key in nextEntry.appState) {
      if (key === "selectedElementIds") {
        continue;
      }
      if (nextEntry.appState[key] !== lastEntry.appState[key]) {
        return true;
      }
    }

    return false;
  }

  pushEntry(appState: AppState, elements: readonly ExcalidrawElement[]) {
    const newEntrySerialized = this.generateEntry(appState, elements);
    const newEntry: HistoryEntry | null = this.parseEntry(newEntrySerialized);

    if (newEntry) {
      if (!this.shouldCreateEntry(newEntry)) {
        return;
      }

      this.stateHistory.push(newEntrySerialized);
      this.lastEntry = newEntry;
      // As a new entry was pushed, we invalidate the redo stack
      this.clearRedoStack();
    }
  }

  private restoreEntry(
    entrySerialized: HistoryEntrySerialized,
  ): HistoryEntry | null {
    const entry = this.parseEntry(entrySerialized);
    if (entry) {
      entry.elements = entry.elements.map((element) => {
        // renew versions
        return newElementWith(element, {});
      });
    }
    return entry;
  }

  clearRedoStack() {
    this.redoStack.splice(0, this.redoStack.length);
  }

  redoOnce(): HistoryEntry | null {
    if (this.redoStack.length === 0) {
      return null;
    }

    const entryToRestore = this.redoStack.pop();

    if (entryToRestore !== undefined) {
      this.stateHistory.push(entryToRestore);
      return this.restoreEntry(entryToRestore);
    }

    return null;
  }

  undoOnce(): HistoryEntry | null {
    if (this.stateHistory.length === 1) {
      return null;
    }

    const currentEntry = this.stateHistory.pop();

    const entryToRestore = this.stateHistory[this.stateHistory.length - 1];

    if (currentEntry !== undefined) {
      this.redoStack.push(currentEntry);
      return this.restoreEntry(entryToRestore);
    }

    return null;
  }

  /**
   * Updates history's `lastEntry` to latest app state. This is necessary
   *  when doing undo/redo which itself doesn't commit to history, but updates
   *  app state in a way that would break `shouldCreateEntry` which relies on
   *  `lastEntry` to reflect last comittable history state.
   * We can't update `lastEntry` from within history when calling undo/redo
   *  because the action potentially mutates appState/elements before storing
   *  it.
   */
  setCurrentState(appState: AppState, elements: readonly ExcalidrawElement[]) {
    this.lastEntry = this.parseEntry(this.generateEntry(appState, elements));
  }

  // Suspicious that this is called so many places. Seems error-prone.
  resumeRecording() {
    this.recording = true;
  }

  record(state: AppState, elements: readonly ExcalidrawElement[]) {
    if (this.recording) {
      this.pushEntry(state, elements);
      this.recording = false;
    }
  }
}

export const createHistory: () => { history: SceneHistory } = () => {
  const history = new SceneHistory();
  return { history };
};
