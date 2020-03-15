import { ExcalidrawElement } from "../element/types";

export interface SceneStateCallback {
  (): void;
}

export interface SceneStateCallbackRemover {
  (): void;
}

class SceneState {
  private callbacks: Set<SceneStateCallback> = new Set();

  constructor(private _elements: readonly ExcalidrawElement[] = []) {}

  getAllElements() {
    return this._elements;
  }

  replaceAllElements(nextElements: readonly ExcalidrawElement[]) {
    this._elements = nextElements;
    this.informMutation();
  }

  informMutation() {
    for (const callback of Array.from(this.callbacks)) {
      callback();
    }
  }

  addCallback(cb: SceneStateCallback): SceneStateCallbackRemover {
    if (this.callbacks.has(cb)) {
      throw new Error();
    }

    this.callbacks.add(cb);

    return () => {
      if (!this.callbacks.has(cb)) {
        throw new Error();
      }
      this.callbacks.delete(cb);
    };
  }
}

export const globalSceneState = new SceneState();
