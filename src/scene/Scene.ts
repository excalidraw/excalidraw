import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "../element/types";
import { getNonDeletedElements, isNonDeletedElement } from "../element";
import { LinearElementEditor } from "../element/linearElementEditor";

type ElementIdKey = InstanceType<typeof LinearElementEditor>["elementId"];
type ElementKey = ExcalidrawElement | ElementIdKey;

type SceneStateCallback = () => void;
type SceneStateCallbackRemover = () => void;

const isIdKey = (elementKey: ElementKey): elementKey is ElementIdKey => {
  if (typeof elementKey === "string") {
    return true;
  }
  return false;
};

class Scene {
  // ---------------------------------------------------------------------------
  // static methods/props
  // ---------------------------------------------------------------------------

  private static sceneMapByElement = new WeakMap<ExcalidrawElement, Scene>();
  private static sceneMapById = new Map<string, Scene>();

  static mapElementToScene(elementKey: ElementKey, scene: Scene) {
    if (isIdKey(elementKey)) {
      this.sceneMapById.set(elementKey, scene);
    } else {
      this.sceneMapByElement.set(elementKey, scene);
    }
  }

  static getScene(elementKey: ElementKey): Scene | null {
    if (isIdKey(elementKey)) {
      return this.sceneMapById.get(elementKey) || null;
    }
    return this.sceneMapByElement.get(elementKey) || null;
  }

  // ---------------------------------------------------------------------------
  // instance methods/props
  // ---------------------------------------------------------------------------

  private callbacks: Set<SceneStateCallback> = new Set();

  private nonDeletedElements: readonly NonDeletedExcalidrawElement[] = [];
  private elements: readonly ExcalidrawElement[] = [];
  private elementsMap = new Map<ExcalidrawElement["id"], ExcalidrawElement>();

  // TODO: getAllElementsIncludingDeleted
  getElementsIncludingDeleted() {
    return this.elements;
  }

  // TODO: getAllNonDeletedElements
  getElements(): readonly NonDeletedExcalidrawElement[] {
    return this.nonDeletedElements;
  }

  getElement<T extends ExcalidrawElement>(id: T["id"]): T | null {
    return (this.elementsMap.get(id) as T | undefined) || null;
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

  // TODO: Rename methods here, this is confusing
  getNonDeletedElements(
    ids: readonly ExcalidrawElement["id"][],
  ): NonDeleted<ExcalidrawElement>[] {
    const result: NonDeleted<ExcalidrawElement>[] = [];
    ids.forEach((id) => {
      const element = this.getNonDeletedElement(id);
      if (element != null) {
        result.push(element);
      }
    });
    return result;
  }

  replaceAllElements(nextElements: readonly ExcalidrawElement[]) {
    this.elements = nextElements;
    this.elementsMap.clear();
    nextElements.forEach((element) => {
      this.elementsMap.set(element.id, element);
      Scene.mapElementToScene(element, this);
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

  destroy() {
    Scene.sceneMapById.forEach((scene, elementKey) => {
      if (scene === this) {
        Scene.sceneMapById.delete(elementKey);
      }
    });
    // done not for memory leaks, but to guard against possible late fires
    // (I guess?)
    this.callbacks.clear();
  }
}

export default Scene;
