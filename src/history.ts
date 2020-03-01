import { AppState } from "./types";
import { ExcalidrawElement } from "./element/types";
import { clearAppStatePropertiesForHistory } from "./appState";

type Result = {
  appState: AppState;
  elements: ExcalidrawElement[];
};

export class SceneHistory {
  private recording: boolean = true;
  private stateHistory: string[] = [];
  private redoStack: string[] = [];

  private generateEntry(
    appState: AppState,
    elements: readonly ExcalidrawElement[],
  ) {
    return JSON.stringify({
      appState: clearAppStatePropertiesForHistory(appState),
      elements: elements.map(({ shape, canvas, ...element }) => ({
        ...element,
        shape: null,
        canvas: null,
        points:
          appState.multiElement && appState.multiElement.id === element.id
            ? element.points.slice(0, -1)
            : element.points,
      })),
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
    if (this.stateHistory.length === 0) {
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

  isRecording() {
    return this.recording;
  }

  skipRecording() {
    this.recording = false;
  }

  resumeRecording() {
    this.recording = true;
  }
}

export const createHistory: () => { history: SceneHistory } = () => {
  const history = new SceneHistory();
  return { history };
};
