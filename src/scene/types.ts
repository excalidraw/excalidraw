import { ExcalidrawTextElement } from "../element/types";
import { AppClassProperties, AppState } from "../types";
import Scene from "./Scene";

export type CanvasUIRenderConfig = {
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  zoom: AppState["zoom"];

  isElementsChanged?: Scene["isElementsChanged"];
  // collab-related state
  // ---------------------------------------------------------------------------
  remotePointerViewportCoords: { [id: string]: { x: number; y: number } };
  remotePointerButton?: { [id: string]: string | undefined };
  remoteSelectedElementIds: { [elementId: string]: string[] };
  remotePointerUsernames: { [id: string]: string };
  remotePointerUserStates: { [id: string]: string };
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  renderScrollbars?: boolean;
  renderSelection?: boolean;
  selectionColor?: string;
  selectedElementIds?: AppState["selectedElementIds"];
  selectedLinearElement?: AppState["selectedLinearElement"];
  selectionElement?: AppState["selectionElement"];
};

export type CanvasContentRenderConfig = {
  // AppState values
  // ---------------------------------------------------------------------------
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  zoom: AppState["zoom"];

  isElementsChanged?: Scene["isElementsChanged"];

  /** null indicates transparent bg */
  viewBackgroundColor: AppState["viewBackgroundColor"] | null;
  shouldCacheIgnoreZoom: AppState["shouldCacheIgnoreZoom"];
  theme: AppState["theme"];

  imageCache: AppClassProperties["imageCache"];
  gridSize?: AppState["gridSize"];
  renderGrid?: boolean;
  /** when exporting the behavior is slightly different (e.g. we can't use
    CSS filters), and we disable render optimizations for best output */
  isExporting: boolean;
};

export type SceneScroll = {
  scrollX: number;
  scrollY: number;
};

// export interface Scene {
//   elements: ExcalidrawTextElement[];
// }

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
