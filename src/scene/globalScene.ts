import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "../element/types";
import { getNonDeletedElements, isNonDeletedElement } from "../element";

export interface SceneStateCallback {
  (): void;
}

export interface SceneStateCallbackRemover {
  (): void;
}

class GlobalScene {
  private nonDeletedElements: readonly NonDeletedExcalidrawElement[] = [];
  private callbacks: Set<SceneStateCallback> = new Set();

  constructor(private _elements: readonly ExcalidrawElement[] = []) {}

  getElementsIncludingDeleted() {
    return this._elements;
  }

  getElements(): readonly NonDeletedExcalidrawElement[] {
    return this.nonDeletedElements;
  }

  getElement(id: ExcalidrawElement["id"]): ExcalidrawElement | null {
    return this._elements.find((element) => element.id === id) || null;
  }

  getNonDeletedElement(
    id: ExcalidrawElement["id"],
  ): NonDeleted<ExcalidrawElement> | null {
    const element = this.getElement(id);
    if (element && isNonDeletedElement(element)) {
      return element;
    }
    return null;
  }

  replaceAllElements(nextElements: readonly ExcalidrawElement[]) {
    this._elements = nextElements;
    this.nonDeletedElements = getNonDeletedElements(this._elements);
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

export const globalSceneState = new GlobalScene();
