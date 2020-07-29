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

type ElementKey = ExcalidrawElement | string;

export type SceneStateCallback = () => void;
export type SceneStateCallbackRemover = () => void;

class Scene {
  // ---------------------------------------------------------------------------
  // static methods/props
  // ---------------------------------------------------------------------------

  private static sceneMapWithElement = new WeakMap<ExcalidrawElement, Scene>();
  private static sceneMapWithId = new Map<string, Scene>();

  static cacheElement(elementKey: ElementKey, scene: Scene) {
    if (typeof elementKey === "string") {
      this.sceneMapWithId.set(elementKey, scene);
    } else {
      this.sceneMapWithElement.set(elementKey, scene);
    }
  }

  static getScene(elementKey: ElementKey): Scene | null {
    if (typeof elementKey === "string") {
      return this.sceneMapWithId.get(elementKey) || null;
    }
    return this.sceneMapWithElement.get(elementKey) || null;
  }

  static destroy(scene: Scene) {
    // TODO
  }

  // ---------------------------------------------------------------------------
  // instance methods/props
  // ---------------------------------------------------------------------------

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
    nextElements.forEach((element) => {
      Scene.cacheElement(element, this);
    });
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

export { Scene };
