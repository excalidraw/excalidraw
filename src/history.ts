import { AppState } from "./types";
import { ExcalidrawElement } from "./element/types";

class SceneHistory {
  private recording: boolean = false;
  private stateHistory: string[] = [];
  private redoStack: string[] = [];

  generateCurrentEntry(
    appState: Partial<AppState>,
    elements: readonly ExcalidrawElement[],
  ) {
    return JSON.stringify({
      appState,
      elements: elements.map(({ shape, ...element }) => ({
        ...element,
        isSelected: false,
        shape: null,
        // TODO: This is a temporary fix.
        // This should be integral to the multi point behavior
        points:
          element.type === "arrow" || element.type === "line"
            ? element.points.slice(0, element.points.length - 1)
            : element.points,
      })),
    });
  }

  pushEntry(newEntry: string) {
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

  redoOnce() {
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

  undoOnce() {
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
