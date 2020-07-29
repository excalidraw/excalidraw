import LocalScene from "./LocalScene";
import { ExcalidrawElement } from "../element/types";

type SceneKey = ExcalidrawElement | string;

class Scene {
  private static sceneMapWithElement = new WeakMap<
    ExcalidrawElement,
    LocalScene
  >();
  private static sceneMapWithId = new Map<string, LocalScene>();
  private static sceneId: number = 1;
  private static scene: Map<number, LocalScene> = new Map<number, LocalScene>();

  static create() {
    const scene = new LocalScene();
    const currentSceneId = this.sceneId;
    this.scene!.set(this.sceneId, scene);
    this.sceneId++;
    return { scene, sceneId: currentSceneId };
  }

  static set(sceneKey: SceneKey, sceneId: number) {
    const scene = this.scene.get(sceneId);
    if (typeof sceneKey === "string") {
      this.sceneMapWithId.set(sceneKey, scene!);
    } else {
      this.sceneMapWithElement.set(sceneKey, scene!);
    }
  }

  static get(sceneKey: SceneKey) {
    if (typeof sceneKey === "string") {
      return this.sceneMapWithId.get(sceneKey);
    }
    return this.sceneMapWithElement.get(sceneKey);
  }

  static destory(sceneId: number) {
    this.scene.delete(sceneId);
  }
}

export { Scene };
