import type { UserIdleState, EditorInterface } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { RenderEnvironment } from "@excalidraw/element/renderEnvironment";

import type {
  SVGPathString,
  ElementShape,
  ElementShapes,
} from "@excalidraw/element/types";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "@excalidraw/element/types";

import type {
  AppClassProperties,
  AppState,
  EmbedsValidationStatus,
  InteractiveCanvasAppState,
  StaticCanvasAppState,
  SocketId,
} from "../types";
import type { RoughCanvas } from "roughjs/bin/canvas";

export type { RenderableElementsMap, StaticCanvasRenderConfig };

export type { SVGPathString, ElementShape, ElementShapes };

export type SVGRenderConfig = {
  /**
   * Host environment used for the text measurements this render needs (the
   * SVG itself is built through `exportToSvg`'s owner document). Defaults to
   * the browser's.
   */
  renderEnvironment?: RenderEnvironment;
  offsetX: number;
  offsetY: number;
  isExporting: boolean;
  exportWithDarkMode: boolean;
  renderEmbeddables: boolean;
  frameRendering: AppState["frameRendering"];
  canvasBackgroundColor: AppState["viewBackgroundColor"];
  embedsValidationStatus: EmbedsValidationStatus;
  /**
   * whether to attempt to reuse images as much as possible through symbols
   * (reduces SVG size, but may be incompoatible with some SVG renderers)
   *
   * @default true
   */
  reuseImages: boolean;
  theme: AppState["theme"];
};

export type InteractiveCanvasRenderConfig = {
  // collab-related state
  // ---------------------------------------------------------------------------
  remoteSelectedElementIds: Map<ExcalidrawElement["id"], SocketId[]>;
  remotePointerViewportCoords: Map<SocketId, { x: number; y: number }>;
  remotePointerUserStates: Map<SocketId, UserIdleState>;
  remotePointerUsernames: Map<SocketId, string>;
  remotePointerButton: Map<SocketId, string | undefined>;
  selectionColor: string;
  lastViewportPosition: { x: number; y: number };
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  renderScrollbars?: boolean;
};

export type RenderInteractiveSceneCallback = {
  scrollBars?: ScrollBars;
};

export type StaticSceneRenderConfig = {
  canvas: HTMLCanvasElement;
  rc: RoughCanvas;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

export type InteractiveSceneRenderAnimationState = {
  bindingHighlight: { runtime: number } | undefined;
};

export type InteractiveSceneRenderConfig = {
  app: AppClassProperties;
  canvas: HTMLCanvasElement | null;
  elementsMap: RenderableElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  selectedElements: readonly NonDeletedExcalidrawElement[];
  allElementsMap: NonDeletedSceneElementsMap;
  scale: number;
  appState: InteractiveCanvasAppState;
  renderConfig: InteractiveCanvasRenderConfig;
  editorInterface: EditorInterface;
  callback: (data: RenderInteractiveSceneCallback) => void;
  animationState?: InteractiveSceneRenderAnimationState;
  deltaTime: number;
};

export type NewElementSceneRenderConfig = {
  canvas: HTMLCanvasElement | null;
  rc: RoughCanvas;
  newElement: NonDeletedExcalidrawElement | null;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  scale: number;
  appState: AppState;
  renderConfig: StaticCanvasRenderConfig;
};

export type SceneScroll = {
  scrollX: number;
  scrollY: number;
};

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
    deltaMultiplier: number;
  } | null;
  vertical: {
    x: number;
    y: number;
    width: number;
    height: number;
    deltaMultiplier: number;
  } | null;
};
