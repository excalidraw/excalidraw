import { AppState } from "./types";
import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";
import { isLinearElement } from "./element/typeChecks";

export type ParsedEntry = {
  appState: ReturnType<typeof clearAppStatePropertiesForHistory>;
  elements: ExcalidrawElement[];
};

const clearAppStatePropertiesForHistory = (appState: AppState) => {
  return {
    selectedElementIds: appState.selectedElementIds,
    exportBackground: appState.exportBackground,
    shouldAddWatermark: appState.shouldAddWatermark,
    currentItemStrokeColor: appState.currentItemStrokeColor,
    currentItemBackgroundColor: appState.currentItemBackgroundColor,
    currentItemFillStyle: appState.currentItemFillStyle,
    currentItemStrokeWidth: appState.currentItemStrokeWidth,
    currentItemRoughness: appState.currentItemRoughness,
    currentItemOpacity: appState.currentItemOpacity,
    currentItemFont: appState.currentItemFont,
    currentItemTextAlign: appState.currentItemTextAlign,
    viewBackgroundColor: appState.viewBackgroundColor,
    name: appState.name,
  };
};

export class SceneHistory {
  private recording: boolean = true;
  private stateHistory: string[] = [];
  private redoStack: string[] = [];
  private lastEntry: ParsedEntry | null = null;

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

          elements.push(
            newElementWith(element, {
              // don't store last point if not committed
              points:
                element.lastCommittedPoint !==
                element.points[element.points.length - 1]
                  ? element.points.slice(0, -1)
                  : element.points,
              // don't regenerate versionNonce else this will short-circuit our
              //  bail-on-no-change logic in pushEntry()
              versionNonce: element.versionNonce,
            }),
          );
        } else {
          elements.push(
            newElementWith(element, { versionNonce: element.versionNonce }),
          );
        }
        return elements;
      }, [] as Mutable<typeof elements>),
    });

  shouldCreateEntry(nextEntry: ParsedEntry): boolean {
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

    // note: this is safe because ParsedEntry is guaranteed no excess props
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
    const newEntry = this.generateEntry(appState, elements);

    // should push entry (first pass)
    if (
      this.stateHistory.length > 0 &&
      this.stateHistory[this.stateHistory.length - 1] === newEntry
    ) {
      return;
    }

    const parsedEntry = this.restoreEntry(newEntry);

    // should push entry (second pass)
    if (!this.shouldCreateEntry(parsedEntry)) {
      return;
    }

    if (parsedEntry) {
      this.stateHistory.push(newEntry);
      this.lastEntry = parsedEntry;
      // As a new entry was pushed, we invalidate the redo stack
      this.clearRedoStack();
    }
  }

  restoreEntry(entry: string) {
    try {
      return JSON.parse(entry);
    } catch {
      return null;
    }
  }

  clearRedoStack() {
    this.redoStack.splice(0, this.redoStack.length);
  }

  redoOnce(): ParsedEntry | null {
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

  undoOnce(): ParsedEntry | null {
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
