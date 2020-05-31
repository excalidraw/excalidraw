import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "../element/types";
import {
  getNonDeletedElements,
  isNonDeletedElement,
  getElementMap,
} from "../element";

export interface SceneStateCallback {
  (): void;
}

export interface SceneStateCallbackRemover {
  (): void;
}

class GlobalScene {
  private callbacks: Set<SceneStateCallback> = new Set();

  private nonDeletedElements: readonly NonDeletedExcalidrawElement[] = [];
  private elements: readonly ExcalidrawElement[] = [];
  private elementsMap: {
    [id: string]: ExcalidrawElement;
  } = {};

  getElementsIncludingDeleted() {
    return this.elements;
  }

  getElements(): readonly NonDeletedExcalidrawElement[] {
    return this.nonDeletedElements;
  }

  getElement(id: ExcalidrawElement["id"]): ExcalidrawElement | null {
    return this.elementsMap[id] || null;
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
    this.elements = nextElements;
    this.elementsMap = getElementMap(nextElements);
    this.nonDeletedElements = getNonDeletedElements(this.elements);
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
