import { ExcalidrawElement, Versioned } from "../element/types";

export interface SceneStateCallback {
  (): void;
}

export interface SceneStateCallbackRemover {
  (): void;
}

class SceneState {
  private callbacks: Set<SceneStateCallback> = new Set();

  constructor(
    private _elements: readonly Versioned<ExcalidrawElement>[] = [],
  ) {}

  getElements(): readonly ExcalidrawElement[] {
    return this._elements.filter(element => !element.isDeleted);
  }

  getElementsIncludingDeleted() {
    return this._elements;
  }

  replaceElementsIncludingDeleted(
    nextElements: readonly Versioned<ExcalidrawElement>[],
  ) {
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
