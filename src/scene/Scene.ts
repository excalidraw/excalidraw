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

  // ts -> elements
  private elementsSnapshots = new Map<Number, ExcalidrawElement[]>();

  getElementsIncludingDeleted() {
    return this.elements;
  }

  getElementsSnapshots() {
    return this.elementsSnapshots;
  }

  getNonDeletedElements(): readonly NonDeletedExcalidrawElement[] {
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

  replaceAllElements(nextElements: readonly ExcalidrawElement[]) {
    this.elements = nextElements;
    this.elementsMap.clear();
    nextElements.forEach((element) => {
      this.elementsMap.set(element.id, element);
      Scene.mapElementToScene(element, this);
    });
    this.nonDeletedElements = getNonDeletedElements(this.elements);
    if (!this.elementsAlreadyExist(this.nonDeletedElements)) {
      this.elementsSnapshots.set(Date.now(), [...this.nonDeletedElements]);
    }
    this.informMutation();
  }

  elementsAlreadyExist(elements: readonly ExcalidrawElement[]): boolean {
    const currentSnapshot = new Set<string>();
    this.elementsSnapshots.forEach((existingElements: ExcalidrawElement[]) => {
      let str = "";
      existingElements.forEach((element) => {
        str += `${
          element.updated +
          element.type +
          element.isDeleted +
          element.angle +
          element.backgroundColor
        },`;
      });
      currentSnapshot.add(str);
    });
    let str = "";
    elements.forEach((element) => {
      str += `${
        element.updated +
        element.type +
        element.isDeleted +
        element.angle +
        element.backgroundColor
      },`;
    });
    return currentSnapshot.has(str);
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
