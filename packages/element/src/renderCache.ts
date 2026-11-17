// Cache of rasterized element canvases. Its own module so the shape cache can
// invalidate it without importing the renderer.

import type { ExcalidrawElement } from "./types";
import type { RenderEnvironment } from "./renderEnvironment";
import type { ExcalidrawTextElement, ExcalidrawImageElement } from "./types";
import type { ElementsState } from "./types";

export const elementWithCanvasCache = new WeakMap<
  ExcalidrawElement,
  ExcalidrawElementWithCanvas
>();

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  theme: ElementsState["theme"];
  scale: number;
  /** backing-store scale the bitmap was rasterized at, see StaticCanvasRenderConfig["scale"] */
  deviceScale: number;
  environment: RenderEnvironment;
  zoomValue: ElementsState["zoom"]["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
  imageCrop: ExcalidrawImageElement["crop"] | null;
  containingFrameOpacity: number;
}
