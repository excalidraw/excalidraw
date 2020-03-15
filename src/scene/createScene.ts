import { ExcalidrawElement } from "../element/types";

class SceneState {
  constructor(private _elements: readonly ExcalidrawElement[] = []) {}

  getAllElements() {
    return this._elements;
  }

  replaceAllElements(nextElements: readonly ExcalidrawElement[]) {
    this._elements = nextElements;
  }
}

export const createScene = () => {
  return new SceneState();
};
