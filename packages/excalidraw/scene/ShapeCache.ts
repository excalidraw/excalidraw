import { RoughGenerator } from "roughjs/bin/generator";

import { COLOR_PALETTE } from "../colors";
import { elementWithCanvasCache } from "../renderer/renderElement";

import { _generateElementShape } from "./Shape";

import type {
  ExcalidrawElement,
  ExcalidrawSelectionElement,
} from "../element/types";
import type { AppState, EmbedsValidationStatus } from "../types";
import type { ElementShape, ElementShapes } from "./types";
import type { Drawable } from "roughjs/bin/core";

export class ShapeCache {
  private static rg = new RoughGenerator();
  private static cache = new WeakMap<ExcalidrawElement, ElementShape>();

  /**
   * Retrieves shape from cache if available. Use this only if shape
   * is optional and you have a fallback in case it's not cached.
   */
  public static get = <T extends ExcalidrawElement>(element: T) => {
    return ShapeCache.cache.get(
      element,
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]] | undefined
      : ElementShape | undefined;
  };

  public static set = <T extends ExcalidrawElement>(
    element: T,
    shape: T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable,
  ) => ShapeCache.cache.set(element, shape);

  public static delete = (element: ExcalidrawElement) =>
    ShapeCache.cache.delete(element);

  public static destroy = () => {
    ShapeCache.cache = new WeakMap();
  };

  /**
   * Generates & caches shape for element if not already cached, otherwise
   * returns cached shape.
   */
  public static generateElementShape = <
    T extends Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  >(
    element: T,
    renderConfig: {
      isExporting: boolean;
      canvasBackgroundColor: AppState["viewBackgroundColor"];
      embedsValidationStatus: EmbedsValidationStatus;
    } | null,
  ) => {
    // when exporting, always regenerated to guarantee the latest shape
    const cachedShape = renderConfig?.isExporting
      ? undefined
      : ShapeCache.get(element);

    // `null` indicates no rc shape applicable for this element type,
    // but it's considered a valid cache value (= do not regenerate)
    if (cachedShape !== undefined) {
      return cachedShape;
    }

    elementWithCanvasCache.delete(element);

    const shape = _generateElementShape(
      element,
      ShapeCache.rg,
      renderConfig || {
        isExporting: false,
        canvasBackgroundColor: COLOR_PALETTE.white,
        embedsValidationStatus: null,
      },
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable | null;

    ShapeCache.cache.set(element, shape);

    return shape;
  };
}
