import { ExcalidrawTextElement } from "../element/types";

export type SceneState = {
  scrollX: number;
  scrollY: number;
  // null indicates transparent bg
  viewBackgroundColor: string | null;
};

export interface Scene {
  elements: ExcalidrawTextElement[];
}
