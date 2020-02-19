import { ExcalidrawTextElement } from "../element/types";
import { FlooredNumber } from "../types";

export type SceneState = {
  scrollX: FlooredNumber;
  scrollY: FlooredNumber;
  // null indicates transparent bg
  viewBackgroundColor: string | null;
  zoom: number;
};

export type SceneScroll = {
  scrollX: FlooredNumber;
  scrollY: FlooredNumber;
};

export interface Scene {
  elements: ExcalidrawTextElement[];
}

export type ExportType = "png" | "clipboard" | "backend" | "svg";
