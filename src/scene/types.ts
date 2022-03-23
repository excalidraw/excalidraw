import { ExcalidrawTextElement } from "../element/types";
import { AppClassProperties, AppState, ExcalidrawProps } from "../types";

export type RenderConfig = {
  // AppState values
  // ---------------------------------------------------------------------------
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  /** null indicates transparent bg */
  viewBackgroundColor: AppState["viewBackgroundColor"] | null;
  zoom: AppState["zoom"];
  shouldCacheIgnoreZoom: AppState["shouldCacheIgnoreZoom"];
  theme: AppState["theme"];
  // collab-related state
  // ---------------------------------------------------------------------------
  remotePointerViewportCoords: { [id: string]: { x: number; y: number } };
  remotePointerButton?: { [id: string]: string | undefined };
  remoteSelectedElementIds: { [elementId: string]: string[] };
  remotePointerUsernames: { [id: string]: string };
  remotePointerUserStates: { [id: string]: string };
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  imageCache: AppClassProperties["imageCache"];
  renderScrollbars?: boolean;
  renderSelection?: boolean;
  renderGrid?: boolean;
  /** when exporting the behavior is slightly different (e.g. we can't use
    CSS filters), and we disable render optimizations for best output */
  isExporting: boolean;
  customElementsConfig?: ExcalidrawProps["customElementsConfig"];
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
