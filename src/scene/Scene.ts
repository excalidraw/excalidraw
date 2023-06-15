import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ExcalidrawFrameElement,
} from "../element/types";
import {
  getNonDeletedElements,
  getNonDeletedFrames,
  isNonDeletedElement,
} from "../element";
import { LinearElementEditor } from "../element/linearElementEditor";
import { isFrameElement } from "../element/typeChecks";

type ElementIdKey = InstanceType<typeof LinearElementEditor>["elementId"];
type ElementKey = ExcalidrawElement | ElementIdKey;

type SceneStateCallback = () => void;
type SceneStateCallbackRemover = () => void;

// ideally this would be a branded type but it'd be insanely hard to work with
// in our codebase
export type ExcalidrawElementsIncludingDeleted = readonly ExcalidrawElement[];

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
      // for cases where we don't have access to the element object
      // (e.g. restore serialized appState with id references)
      this.sceneMapById.set(elementKey, scene);
    } else {
      this.sceneMapByElement.set(elementKey, scene);
      // if mapping element objects, also cache the id string when later
      // looking up by id alone
      this.sceneMapById.set(elementKey.id, scene);
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
  private nonDeletedFrames: readonly NonDeleted<ExcalidrawFrameElement>[] = [];
  private frames: readonly ExcalidrawFrameElement[] = [];
  private elementsMap = new Map<ExcalidrawElement["id"], ExcalidrawElement>();

  getElementsIncludingDeleted() {
    return this.elements;
  }

  getNonDeletedElements(): readonly NonDeletedExcalidrawElement[] {
    return this.nonDeletedElements;
  }

  getFramesIncludingDeleted() {
    return this.frames;
  }

  getNonDeletedFrames(): readonly NonDeleted<ExcalidrawFrameElement>[] {
    return this.nonDeletedFrames;
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

  /**
   * A utility method to help with updating all scene elements, with the added
   * performance optimization of not renewing the array if no change is made.
   *
   * Maps all current excalidraw elements, invoking the callback for each
   * element. The callback should either return a new mapped element, or the
   * original element if no changes are made. If no changes are made to any
   * element, this results in a no-op. Otherwise, the newly mapped elements
   * are set as the next scene's elements.
   *
   * @returns whether a change was made
   */
  mapElements(
    iteratee: (element: ExcalidrawElement) => ExcalidrawElement,
  ): boolean {
    let didChange = false;
    const newElements = this.elements.map((element) => {
      const nextElement = iteratee(element);
      if (nextElement !== element) {
        didChange = true;
      }
      return nextElement;
    });
    if (didChange) {
      this.replaceAllElements(newElements);
    }
    return didChange;
  }

  replaceAllElements(nextElements: readonly ExcalidrawElement[]) {
    this.elements = nextElements;
    const nextFrames: ExcalidrawFrameElement[] = [];
    this.elementsMap.clear();
    nextElements.forEach((element) => {
      if (isFrameElement(element)) {
        nextFrames.push(element);
      }
      this.elementsMap.set(element.id, element);
      Scene.mapElementToScene(element, this);
    });
    this.nonDeletedElements = getNonDeletedElements(this.elements);
    this.frames = nextFrames;
    this.nonDeletedFrames = getNonDeletedFrames(this.frames);

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

  insertElementAtIndex(element: ExcalidrawElement, index: number) {
    if (!Number.isFinite(index) || index < 0) {
      throw new Error(
        "insertElementAtIndex can only be called with index >= 0",
      );
    }
    const nextElements = [
      ...this.elements.slice(0, index),
      element,
      ...this.elements.slice(index),
    ];
    this.replaceAllElements(nextElements);
  }

  insertElementsAtIndex(elements: ExcalidrawElement[], index: number) {
    if (!Number.isFinite(index) || index < 0) {
      throw new Error(
        "insertElementAtIndex can only be called with index >= 0",
      );
    }
    const nextElements = [
      ...this.elements.slice(0, index),
      ...elements,
      ...this.elements.slice(index),
    ];

    this.replaceAllElements(nextElements);
  }

  addNewElement = (element: ExcalidrawElement) => {
    if (element.frameId) {
      this.insertElementAtIndex(element, this.getElementIndex(element.frameId));
    } else {
      this.replaceAllElements([...this.elements, element]);
    }
  };

  getElementIndex(elementId: string) {
    return this.elements.findIndex((element) => element.id === elementId);
  }
}

export default Scene;
