import { ExcalidrawElement } from "./element/types";
import { generateDraw } from "./element";

export class SceneHistory {
  recording: boolean = true;
  stateHistory: string[] = [];
  redoStack: string[] = [];

  generateCurrentEntry(elements: ExcalidrawElement[]) {
    return JSON.stringify(
      elements.map(element => ({ ...element, isSelected: false }))
    );
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

  skipRecording() {
    this.recording = false;
  }

  isRecording() {
    return this.recording;
  }

  continueRecording() {
    this.recording = true;
  }
}
