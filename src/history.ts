import { ExcalidrawElement } from "./element/types";
import { generateDraw } from "./element";

class SceneHistory {
  recording: boolean = true;
  stateHistory: string[] = [];
  redoStack: string[] = [];

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
      generateDraw(newElement);
      elements.push(newElement);
    });
    // When restoring, we shouldn't add an history entry otherwise we'll be stuck with it and can't go back
    this.skipRecording();
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
