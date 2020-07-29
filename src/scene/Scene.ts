import LocalScene from "./LocalScene";
import { ExcalidrawElement } from "../element/types";

type SceneKey = ExcalidrawElement | string;

class Scene {
  private static sceneMapWithElement = new WeakMap<
    ExcalidrawElement,
    LocalScene
  >();
  private static sceneMapWithId = new Map<string, LocalScene>();

  static create() {
    return new LocalScene();
  }

  static set(sceneKey: SceneKey, scene: LocalScene) {
    if (typeof sceneKey === "string") {
      this.sceneMapWithId.set(sceneKey, scene);
    } else {
      this.sceneMapWithElement.set(sceneKey, scene);
    }
  }

  static get(sceneKey: SceneKey) {
    if (typeof sceneKey === "string") {
      return this.sceneMapWithId.get(sceneKey);
    }
    return this.sceneMapWithElement.get(sceneKey);
  }

  static destory(scene: LocalScene) {
    // TODO
  }
}

export { Scene };
