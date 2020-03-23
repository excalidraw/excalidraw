import { AppState } from "./types";
import { ExcalidrawElement } from "./element/types";
import { clearAppStatePropertiesForHistory } from "./appState";
import { newElementWith } from "./element/mutateElement";
import { isLinearElement } from "./element/typeChecks";

type Result = {
  appState: AppState;
  elements: ExcalidrawElement[];
};

export class SceneHistory {
  private recording: boolean = true;
  private stateHistory: string[] = [];
  private redoStack: string[] = [];

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

  private generateEntry(
    appState: AppState,
    elements: readonly ExcalidrawElement[],
  ) {
    return JSON.stringify({
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
  }

  pushEntry(appState: AppState, elements: readonly ExcalidrawElement[]) {
    const newEntry = this.generateEntry(appState, elements);
    if (
      this.stateHistory.length > 0 &&
      this.stateHistory[this.stateHistory.length - 1] === newEntry
    ) {
      // If the last entry is the same as this one, ignore it
      return;
    }

    this.stateHistory.push(newEntry);

    // As a new entry was pushed, we invalidate the redo stack
    this.clearRedoStack();
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

  redoOnce(): Result | null {
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

  undoOnce(): Result | null {
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
