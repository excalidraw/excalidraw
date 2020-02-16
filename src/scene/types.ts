import { ExcalidrawTextElement } from "../element/types";
import { AppState } from "../types";

export type SceneState = {
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  // null indicates transparent bg
  viewBackgroundColor: string | null;
  zoom: number;
};

export type SceneScroll = {
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
};

export interface Scene {
  elements: ExcalidrawTextElement[];
}

export type ExportType = "png" | "clipboard" | "backend" | "svg";
