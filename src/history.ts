import { ExcalidrawElement } from "./element/types";

class SceneHistory {
  private recording: boolean = true;
  private stateHistory: string[] = [];
  private redoStack: string[] = [];

  generateCurrentEntry(elements: ExcalidrawElement[]) {
    return JSON.stringify(
      elements.map(element => ({ ...element, isSelected: false }))
    );
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
  }

  restoreEntry(elements: ExcalidrawElement[], entry: string) {
    const newElements = JSON.parse(entry);
    elements.splice(0, elements.length);
    newElements.forEach((newElement: ExcalidrawElement) => {
      elements.push(newElement);
    });
    // When restoring, we shouldn't add an history entry otherwise we'll be stuck with it and can't go back
    this.skipRecording();
  }

  clearRedoStack() {
    this.redoStack.splice(0, this.redoStack.length);
  }

  redoOnce(elements: ExcalidrawElement[]) {
    const currentEntry = this.generateCurrentEntry(elements);
    const entryToRestore = this.redoStack.pop();
    if (entryToRestore !== undefined) {
      this.restoreEntry(elements, entryToRestore);
      this.stateHistory.push(currentEntry);
    }
  }

  undoOnce(elements: ExcalidrawElement[]) {
    const currentEntry = this.generateCurrentEntry(elements);
    let entryToRestore = this.stateHistory.pop();

    // If nothing was changed since last, take the previous one
    if (currentEntry === entryToRestore) {
      entryToRestore = this.stateHistory.pop();
    }
    if (entryToRestore !== undefined) {
      this.restoreEntry(elements, entryToRestore);
      this.redoStack.push(currentEntry);
    }
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
