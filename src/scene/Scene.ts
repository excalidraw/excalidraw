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

type SceneKey = ExcalidrawElement | string;

export type SceneStateCallback = () => void;
export type SceneStateCallbackRemover = () => void;

class Scene {
  // ---------------------------------------------------------------------------
  // static methods/props
  // ---------------------------------------------------------------------------

  private static sceneMapWithElement = new WeakMap<ExcalidrawElement, Scene>();
  private static sceneMapWithId = new Map<string, Scene>();

  static set(sceneKey: SceneKey, scene: Scene) {
    if (typeof sceneKey === "string") {
      this.sceneMapWithId.set(sceneKey, scene);
    } else {
      this.sceneMapWithElement.set(sceneKey, scene);
    }
  }

  static get(sceneKey: SceneKey): Scene | null {
    if (typeof sceneKey === "string") {
      return this.sceneMapWithId.get(sceneKey) || null;
    }
    return this.sceneMapWithElement.get(sceneKey) || null;
  }

  static destory(scene: Scene) {
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
      Scene.set(element, this);
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
