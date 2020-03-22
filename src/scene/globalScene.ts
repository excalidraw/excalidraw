import { ExcalidrawElement, Versioned, NonDeleted } from "../element/types";
import { versionedToNonDeleted } from "../element";

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

  getElements(): readonly NonDeleted<ExcalidrawElement>[] {
    return versionedToNonDeleted(this._elements);
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
