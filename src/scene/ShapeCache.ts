import { Drawable } from "roughjs/bin/core";
import { RoughGenerator } from "roughjs/bin/generator";
import { ExcalidrawElement } from "../element/types";
import { generateElementShape } from "../renderer/renderElement";

type ElementShape = Drawable | Drawable[] | null;

type ElementShapes = {
  freedraw: Drawable | null;
  arrow: Drawable[];
  line: Drawable[];
  text: null;
  image: null;
};

export class ShapeCache {
  private static rg = new RoughGenerator();
  private static cache = new WeakMap<ExcalidrawElement, ElementShape>();

  public static get = <T extends ExcalidrawElement>(element: T) => {
    return ShapeCache.cache.get(
      element,
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]] | undefined
      : Drawable | null | undefined;
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
   * return cached shape.
   */
  public static generateElementShape = <T extends ExcalidrawElement>(
    element: T,
  ) => {
    const shape = generateElementShape(
      element,
      ShapeCache.rg,
      /* so it prefers cache */ false,
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable | null;

    ShapeCache.cache.set(element, shape);

    return shape;
  };
}
