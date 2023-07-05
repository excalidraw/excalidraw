import { RoughCanvas } from "roughjs/bin/canvas";
import {
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import {
  AppClassProperties,
  InteractiveCanvasAppState,
  StaticCanvasAppState,
} from "../types";

export type StaticCanvasRenderConfig = {
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  imageCache: AppClassProperties["imageCache"];
  renderGrid: boolean;
  /** when exporting the behavior is slightly different (e.g. we can't use
   CSS filters), and we disable render optimizations for best output */
  isExporting: boolean;
};

export type InteractiveCanvasRenderConfig = {
  // collab-related state
  // ---------------------------------------------------------------------------
  remoteSelectedElementIds: { [elementId: string]: string[] };
  remotePointerViewportCoords: { [id: string]: { x: number; y: number } };
  remotePointerUserStates: { [id: string]: string };
  remotePointerUsernames: { [id: string]: string };
  remotePointerButton?: { [id: string]: string | undefined };
  selectionColor?: string;
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  renderScrollbars?: boolean;
};

export type RenderInteractiveSceneCallback = {
  atLeastOneVisibleElement: boolean;
  elements: readonly NonDeletedExcalidrawElement[];
  scrollBars?: ScrollBars;
};

export type StaticSceneRenderConfig = {
  elements: readonly NonDeletedExcalidrawElement[];
  scale: number;
  canvas: HTMLCanvasElement | null;
  rc: RoughCanvas;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

export type InteractiveSceneRenderConfig = {
  elements: readonly NonDeletedExcalidrawElement[];
  canvas: HTMLCanvasElement | null;
  scale: number;
  appState: InteractiveCanvasAppState;
  renderConfig: InteractiveCanvasRenderConfig;
  callback: (data: RenderInteractiveSceneCallback) => void;
};

export type SceneScroll = {
  scrollX: number;
  scrollY: number;
};

export interface Scene {
  elements: ExcalidrawTextElement[];
}

export type ExportType =
  | "png"
  | "clipboard"
  | "clipboard-svg"
  | "backend"
  | "svg";

export type ScrollBars = {
  horizontal: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  vertical: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};
