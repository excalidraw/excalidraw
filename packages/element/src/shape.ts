import { simplify } from "points-on-curve";

import {
  type GeometricShape,
  getClosedCurveShape,
  getCurveShape,
  getEllipseShape,
  getFreedrawShape,
  getPolygonShape,
} from "@excalidraw/utils/shape";

import {
  pointFrom,
  pointDistance,
  type LocalPoint,
  pointRotateRads,
} from "@excalidraw/math";
import {
  ROUGHNESS,
  THEME,
  isTransparent,
  assertNever,
  COLOR_PALETTE,
  LINE_POLYGON_POINT_MERGE_DISTANCE,
  applyDarkModeFilter,
} from "@excalidraw/common";

import { RoughGenerator } from "roughjs/bin/generator";

import type {
  ElementShape,
  ElementShapes,
  SVGPathString,
} from "@excalidraw/excalidraw/scene/types";

import type { GlobalPoint } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import type {
  AppState,
  EmbedsValidationStatus,
} from "@excalidraw/excalidraw/types";

import { elementWithCanvasCache } from "./renderElement";

import {
  canBecomePolygon,
  isElbowArrow,
  isEmbeddableElement,
  isIframeElement,
  isIframeLikeElement,
  isLinearElement,
} from "./typeChecks";
import { getCornerRadius, isPathALoop } from "./utils";
import { headingForPointIsHorizontal } from "./heading";

import { canChangeRoundness } from "./comparisons";
import {
  elementCenterPoint,
  getArrowheadPoints,
  getDiamondPoints,
  getElementAbsoluteCoords,
} from "./bounds";
import { shouldTestInside } from "./collision";

import type {
  ExcalidrawElement,
  ExcalidrawSelectionElement,
  ExcalidrawLinearElement,
  ExcalidrawFreeDrawElement,
  ElementsMap,
  ExcalidrawLineElement,
  Arrowhead,
} from "./types";

import type { Drawable, Options } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";

export class ShapeCache {
  private static rg = new RoughGenerator();
  private static cache = new WeakMap<
    ExcalidrawElement,
    { shape: ElementShape; theme: AppState["theme"] }
  >();

  /**
   * Retrieves shape from cache if available. Use this only if shape
   * is optional and you have a fallback in case it's not cached.
   */
  public static get = <T extends ExcalidrawElement>(
    element: T,
    theme: AppState["theme"] | null,
  ) => {
    const cached = ShapeCache.cache.get(element);
    if (cached && (theme === null || cached.theme === theme)) {
      return cached.shape as T["type"] extends keyof ElementShapes
        ? ElementShapes[T["type"]] | undefined
        : ElementShape | undefined;
    }
    return undefined;
  };

  public static delete = (element: ExcalidrawElement) => {
    ShapeCache.cache.delete(element);
    elementWithCanvasCache.delete(element);
  };

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
      theme: AppState["theme"];
    } | null,
  ) => {
    // when exporting, always regenerated to guarantee the latest shape
    const cachedShape = renderConfig?.isExporting
      ? undefined
      : ShapeCache.get(element, renderConfig ? renderConfig.theme : null);

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
        theme: THEME.LIGHT,
      },
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable | null;

    if (!renderConfig?.isExporting) {
      ShapeCache.cache.set(element, {
        shape,
        theme: renderConfig?.theme || THEME.LIGHT,
      });
    }

    return shape;
  };
}

const getDashArrayDashed = (strokeWidth: number) => [8, 8 + strokeWidth];

const getDashArrayDotted = (strokeWidth: number) => [1.5, 6 + strokeWidth];

function adjustRoughness(element: ExcalidrawElement): number {
  const roughness = element.roughness;

  const maxSize = Math.max(element.width, element.height);
  const minSize = Math.min(element.width, element.height);

  // don't reduce roughness if
  if (
    // both sides relatively big
    (minSize >= 20 && maxSize >= 50) ||
    // is round & both sides above 15px
    (minSize >= 15 &&
      !!element.roundness &&
      canChangeRoundness(element.type)) ||
    // relatively long linear element
    (isLinearElement(element) && maxSize >= 50)
  ) {
    return roughness;
  }

  return Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5);
}

export const generateRoughOptions = (
  element: ExcalidrawElement,
  continuousPath = false,
  isDarkMode: boolean = false,
): Options => {
  const options: Options = {
    seed: element.seed,
    strokeLineDash:
      element.strokeStyle === "dashed"
        ? getDashArrayDashed(element.strokeWidth)
        : element.strokeStyle === "dotted"
        ? getDashArrayDotted(element.strokeWidth)
        : undefined,
    // for non-solid strokes, disable multiStroke because it tends to make
    // dashes/dots overlay each other
    disableMultiStroke: element.strokeStyle !== "solid",
    // for non-solid strokes, increase the width a bit to make it visually
    // similar to solid strokes, because we're also disabling multiStroke
    strokeWidth:
      element.strokeStyle !== "solid"
        ? element.strokeWidth + 0.5
        : element.strokeWidth,
    // when increasing strokeWidth, we must explicitly set fillWeight and
    // hachureGap because if not specified, roughjs uses strokeWidth to
    // calculate them (and we don't want the fills to be modified)
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 4,
    roughness: adjustRoughness(element),
    stroke: applyDarkModeFilter(element.strokeColor, isDarkMode),
    preserveVertices:
      continuousPath || element.roughness < ROUGHNESS.cartoonist,
  };

  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      options.fillStyle = element.fillStyle;
      options.fill = isTransparent(element.backgroundColor)
        ? undefined
        : applyDarkModeFilter(element.backgroundColor, isDarkMode);
      if (element.type === "ellipse") {
        options.curveFitting = 1;
      }
      return options;
    }
    case "line":
    case "freedraw": {
      if (isPathALoop(element.points)) {
        options.fillStyle = element.fillStyle;
        options.fill =
          element.backgroundColor === "transparent"
            ? undefined
            : applyDarkModeFilter(element.backgroundColor, isDarkMode);
      }
      return options;
    }
    case "arrow":
      return options;
    default: {
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};

const modifyIframeLikeForRoughOptions = (
  element: ExcalidrawElement,
  isExporting: boolean,
  embedsValidationStatus: EmbedsValidationStatus | null,
) => {
  if (
    isIframeLikeElement(element) &&
    (isExporting ||
      (isEmbeddableElement(element) &&
        embedsValidationStatus?.get(element.id) !== true)) &&
    isTransparent(element.backgroundColor) &&
    isTransparent(element.strokeColor)
  ) {
    return {
      ...element,
      roughness: 0,
      backgroundColor: "#d3d3d3",
      fillStyle: "solid",
    } as const;
  } else if (isIframeElement(element)) {
    return {
      ...element,
      strokeColor: isTransparent(element.strokeColor)
        ? "#000000"
        : element.strokeColor,
      backgroundColor: isTransparent(element.backgroundColor)
        ? "#f4f4f6"
        : element.backgroundColor,
    };
  }
  return element;
};

const generateArrowheadCardinalityOne = (
  generator: RoughGenerator,
  arrowheadPoints: number[] | null,
  lineOptions: Options,
) => {
  if (arrowheadPoints === null) {
    return [];
  }

  const [, , x3, y3, x4, y4] = arrowheadPoints;

  return [generator.line(x3, y3, x4, y4, lineOptions)];
};

const generateArrowheadLinesToTip = (
  generator: RoughGenerator,
  arrowheadPoints: number[] | null,
  lineOptions: Options,
) => {
  if (arrowheadPoints === null) {
    return [];
  }

  const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;

  return [
    generator.line(x3, y3, x2, y2, lineOptions),
    generator.line(x4, y4, x2, y2, lineOptions),
  ];
};

const getArrowheadLineOptions = (
  element: ExcalidrawLinearElement,
  options: Options,
) => {
  const lineOptions = { ...options };

  if (element.strokeStyle === "dotted") {
    // for dotted arrows caps, reduce gap to make it more legible
    const dash = getDashArrayDotted(element.strokeWidth - 1);
    lineOptions.strokeLineDash = [dash[0], dash[1] - 1];
  } else {
    // for solid/dashed, keep solid arrow cap
    delete lineOptions.strokeLineDash;
  }
  lineOptions.roughness = Math.min(1, lineOptions.roughness || 0);

  return lineOptions;
};

const generateArrowheadOutlineCircle = (
  generator: RoughGenerator,
  options: Options,
  strokeColor: string,
  arrowheadPoints: number[] | null,
  fill: string,
  diameterScale = 1,
) => {
  if (arrowheadPoints === null) {
    return [];
  }

  const [x, y, diameter] = arrowheadPoints;
  const circleOptions = {
    ...options,
    fill,
    fillStyle: "solid" as const,
    stroke: strokeColor,
    roughness: Math.min(0.5, options.roughness || 0),
  };

  delete circleOptions.strokeLineDash;

  return [generator.circle(x, y, diameter * diameterScale, circleOptions)];
};

const getArrowheadShapes = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
  generator: RoughGenerator,
  options: Options,
  canvasBackgroundColor: string,
  isDarkMode: boolean,
) => {
  if (arrowhead === null) {
    return [];
  }

  const strokeColor = applyDarkModeFilter(element.strokeColor, isDarkMode);
  const backgroundFillColor = applyDarkModeFilter(
    canvasBackgroundColor,
    isDarkMode,
  );
  const cardinalityOneOrManyOffset = -0.25;
  const cardinalityZeroCircleScale = 0.8;

  switch (arrowhead) {
    case "circle":
    case "circle_outline": {
      return generateArrowheadOutlineCircle(
        generator,
        options,
        strokeColor,
        getArrowheadPoints(element, shape, position, arrowhead),
        arrowhead === "circle_outline" ? backgroundFillColor : strokeColor,
      );
    }
    case "triangle":
    case "triangle_outline": {
      const arrowheadPoints = getArrowheadPoints(
        element,
        shape,
        position,
        arrowhead,
      );

      if (arrowheadPoints === null) {
        return [];
      }

      const [x, y, x2, y2, x3, y3] = arrowheadPoints;
      const triangleOptions = {
        ...options,
        fill:
          arrowhead === "triangle_outline" ? backgroundFillColor : strokeColor,
        fillStyle: "solid" as const,
        roughness: Math.min(1, options.roughness || 0),
      };

      // always use solid stroke for arrowhead
      delete triangleOptions.strokeLineDash;

      return [
        generator.polygon(
          [
            [x, y],
            [x2, y2],
            [x3, y3],
            [x, y],
          ],
          triangleOptions,
        ),
      ];
    }
    case "diamond":
    case "diamond_outline": {
      const arrowheadPoints = getArrowheadPoints(
        element,
        shape,
        position,
        arrowhead,
      );

      if (arrowheadPoints === null) {
        return [];
      }

      const [x, y, x2, y2, x3, y3, x4, y4] = arrowheadPoints;
      const diamondOptions = {
        ...options,
        fill:
          arrowhead === "diamond_outline" ? backgroundFillColor : strokeColor,
        fillStyle: "solid" as const,
        roughness: Math.min(1, options.roughness || 0),
      };

      // always use solid stroke for arrowhead
      delete diamondOptions.strokeLineDash;

      return [
        generator.polygon(
          [
            [x, y],
            [x2, y2],
            [x3, y3],
            [x4, y4],
            [x, y],
          ],
          diamondOptions,
        ),
      ];
    }
    case "cardinality_one":
      return generateArrowheadCardinalityOne(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options),
      );
    case "cardinality_many":
      return generateArrowheadLinesToTip(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options),
      );
    case "cardinality_one_or_many": {
      const lineOptions = getArrowheadLineOptions(element, options);

      return [
        ...generateArrowheadLinesToTip(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_many"),
          lineOptions,
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(
            element,
            shape,
            position,
            "cardinality_one",
            cardinalityOneOrManyOffset,
          ),
          lineOptions,
        ),
      ];
    }
    case "cardinality_exactly_one": {
      const lineOptions = getArrowheadLineOptions(element, options);

      return [
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_one", -0.5),
          lineOptions,
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_one"),
          lineOptions,
        ),
      ];
    }
    case "cardinality_zero_or_one": {
      const lineOptions = getArrowheadLineOptions(element, options);

      return [
        ...generateArrowheadOutlineCircle(
          generator,
          options,
          strokeColor,
          getArrowheadPoints(element, shape, position, "circle_outline", 1.5),
          backgroundFillColor,
          cardinalityZeroCircleScale,
        ),
        ...generateArrowheadCardinalityOne(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_one", -0.5),
          lineOptions,
        ),
      ];
    }
    case "cardinality_zero_or_many": {
      const lineOptions = getArrowheadLineOptions(element, options);

      return [
        ...generateArrowheadLinesToTip(
          generator,
          getArrowheadPoints(element, shape, position, "cardinality_many"),
          lineOptions,
        ),
        ...generateArrowheadOutlineCircle(
          generator,
          options,
          strokeColor,
          getArrowheadPoints(element, shape, position, "circle_outline", 1.5),
          backgroundFillColor,
          cardinalityZeroCircleScale,
        ),
      ];
    }
    case "bar":
    case "arrow":
    default: {
      return generateArrowheadLinesToTip(
        generator,
        getArrowheadPoints(element, shape, position, arrowhead),
        getArrowheadLineOptions(element, options),
      );
    }
  }
};

export const generateLinearCollisionShape = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
  elementsMap: ElementsMap,
): {
  op: string;
  data: number[];
}[] => {
  const generator = new RoughGenerator();
  const options: Options = {
    seed: element.seed,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    roughness: 0,
    preserveVertices: true,
  };
  const center = elementCenterPoint(element, elementsMap);

  switch (element.type) {
    case "line":
    case "arrow": {
      // points array can be empty in the beginning, so it is important to add
      // initial position to it
      const points = element.points.length
        ? element.points
        : [pointFrom<LocalPoint>(0, 0)];

      if (isElbowArrow(element)) {
        return generator.path(generateElbowArrowShape(points, 16), options)
          .sets[0].ops;
      } else if (!element.roundness) {
        return points.map((point, idx) => {
          const p = pointRotateRads(
            pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
            center,
            element.angle,
          );

          return {
            op: idx === 0 ? "move" : "lineTo",
            data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
          };
        });
      }

      return generator
        .curve(points as unknown as RoughPoint[], options)
        .sets[0].ops.slice(0, element.points.length)
        .map((op, i) => {
          if (i === 0) {
            const p = pointRotateRads<GlobalPoint>(
              pointFrom<GlobalPoint>(
                element.x + op.data[0],
                element.y + op.data[1],
              ),
              center,
              element.angle,
            );

            return {
              op: "move",
              data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
            };
          }

          return {
            op: "bcurveTo",
            data: [
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[0],
                  element.y + op.data[1],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[2],
                  element.y + op.data[3],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[4],
                  element.y + op.data[5],
                ),
                center,
                element.angle,
              ),
            ]
              .map((p) =>
                pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
              )
              .flat(),
          };
        });
    }
    case "freedraw": {
      if (element.points.length < 2) {
        return [];
      }

      const simplifiedPoints = simplify(
        element.points as Mutable<LocalPoint[]>,
        0.75,
      );

      return generator
        .curve(simplifiedPoints as [number, number][], options)
        .sets[0].ops.slice(0, element.points.length)
        .map((op, i) => {
          if (i === 0) {
            const p = pointRotateRads<GlobalPoint>(
              pointFrom<GlobalPoint>(
                element.x + op.data[0],
                element.y + op.data[1],
              ),
              center,
              element.angle,
            );

            return {
              op: "move",
              data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
            };
          }

          return {
            op: "bcurveTo",
            data: [
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[0],
                  element.y + op.data[1],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[2],
                  element.y + op.data[3],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[4],
                  element.y + op.data[5],
                ),
                center,
                element.angle,
              ),
            ]
              .map((p) =>
                pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
              )
              .flat(),
          };
        });
    }
  }
};

/**
 * Generates the roughjs shape for given element.
 *
 * Low-level. Use `ShapeCache.generateElementShape` instead.
 *
 * @private
 */
const _generateElementShape = (
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  generator: RoughGenerator,
  {
    isExporting,
    canvasBackgroundColor,
    embedsValidationStatus,
    theme,
  }: {
    isExporting: boolean;
    canvasBackgroundColor: string;
    embedsValidationStatus: EmbedsValidationStatus | null;
    theme?: AppState["theme"];
  },
): ElementShape => {
  const isDarkMode = theme === THEME.DARK;
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable": {
      let shape: ElementShapes[typeof element.type];
      // this is for rendering the stroke/bg of the embeddable, especially
      // when the src url is not set

      if (element.roundness) {
        const w = element.width;
        const h = element.height;
        const r = getCornerRadius(Math.min(w, h), element);
        shape = generator.path(
          `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${
            h - r
          } Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${
            h - r
          } L 0 ${r} Q 0 0, ${r} 0`,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus,
            ),
            true,
            isDarkMode,
          ),
        );
      } else {
        shape = generator.rectangle(
          0,
          0,
          element.width,
          element.height,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus,
            ),
            false,
            isDarkMode,
          ),
        );
      }
      return shape;
    }
    case "diamond": {
      let shape: ElementShapes[typeof element.type];

      const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
        getDiamondPoints(element);
      if (element.roundness) {
        const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);

        const horizontalRadius = getCornerRadius(
          Math.abs(rightY - topY),
          element,
        );

        shape = generator.path(
          `M ${topX + verticalRadius} ${topY + horizontalRadius} L ${
            rightX - verticalRadius
          } ${rightY - horizontalRadius}
            C ${rightX} ${rightY}, ${rightX} ${rightY}, ${
            rightX - verticalRadius
          } ${rightY + horizontalRadius}
            L ${bottomX + verticalRadius} ${bottomY - horizontalRadius}
            C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${
            bottomX - verticalRadius
          } ${bottomY - horizontalRadius}
            L ${leftX + verticalRadius} ${leftY + horizontalRadius}
            C ${leftX} ${leftY}, ${leftX} ${leftY}, ${leftX + verticalRadius} ${
            leftY - horizontalRadius
          }
            L ${topX - verticalRadius} ${topY + horizontalRadius}
            C ${topX} ${topY}, ${topX} ${topY}, ${topX + verticalRadius} ${
            topY + horizontalRadius
          }`,
          generateRoughOptions(element, true, isDarkMode),
        );
      } else {
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          generateRoughOptions(element, false, isDarkMode),
        );
      }
      return shape;
    }
    case "ellipse": {
      const shape: ElementShapes[typeof element.type] = generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        generateRoughOptions(element, false, isDarkMode),
      );
      return shape;
    }
    case "line":
    case "arrow": {
      let shape: ElementShapes[typeof element.type];
      const options = generateRoughOptions(element, false, isDarkMode);

      // points array can be empty in the beginning, so it is important to add
      // initial position to it
      const points = element.points.length
        ? element.points
        : [pointFrom<LocalPoint>(0, 0)];

      if (isElbowArrow(element)) {
        // NOTE (mtolmacs): Temporary fix for extremely big arrow shapes
        if (
          !points.every(
            (point) => Math.abs(point[0]) <= 1e6 && Math.abs(point[1]) <= 1e6,
          )
        ) {
          console.error(
            `Elbow arrow with extreme point positions detected. Arrow not rendered.`,
            element.id,
            JSON.stringify(points),
          );
          shape = [];
        } else {
          shape = [
            generator.path(
              generateElbowArrowShape(points, 16),
              generateRoughOptions(element, true, isDarkMode),
            ),
          ];
        }
      } else if (!element.roundness) {
        // curve is always the first element
        // this simplifies finding the curve for an element
        if (options.fill) {
          shape = [
            generator.polygon(points as unknown as RoughPoint[], options),
          ];
        } else {
          shape = [
            generator.linearPath(points as unknown as RoughPoint[], options),
          ];
        }
      } else {
        shape = [generator.curve(points as unknown as RoughPoint[], options)];
      }

      // add lines only in arrow
      if (element.type === "arrow") {
        const { startArrowhead = null, endArrowhead = "arrow" } = element;

        if (startArrowhead !== null) {
          const shapes = getArrowheadShapes(
            element,
            shape,
            "start",
            startArrowhead,
            generator,
            options,
            canvasBackgroundColor,
            isDarkMode,
          );
          shape.push(...shapes);
        }

        if (endArrowhead !== null) {
          if (endArrowhead === undefined) {
            // Hey, we have an old arrow here!
          }

          const shapes = getArrowheadShapes(
            element,
            shape,
            "end",
            endArrowhead,
            generator,
            options,
            canvasBackgroundColor,
            isDarkMode,
          );
          shape.push(...shapes);
        }
      }
      return shape;
    }
    case "freedraw": {
      // oredered in terms of z-index [background, stroke]
      const shapes: ElementShapes[typeof element.type] = [];

      // (1) background fill (rc shape), optional
      if (isPathALoop(element.points)) {
        // generate rough polygon to fill freedraw shape
        const simplifiedPoints = simplify(
          element.points as Mutable<LocalPoint[]>,
          0.75,
        );
        shapes.push(
          generator.curve(simplifiedPoints as [number, number][], {
            ...generateRoughOptions(element, false, isDarkMode),
            stroke: "none",
          }),
        );
      }

      // (2) stroke
      shapes.push(...getFreeDrawCapsulePaths(element));

      return shapes;
    }
    case "frame":
    case "magicframe":
    case "text":
    case "image": {
      const shape: ElementShapes[typeof element.type] = null;
      // we return (and cache) `null` to make sure we don't regenerate
      // `element.canvas` on rerenders
      return shape;
    }
    default: {
      assertNever(
        element,
        `generateElementShape(): Unimplemented type ${(element as any)?.type}`,
      );
      return null;
    }
  }
};

const generateElbowArrowShape = (
  points: readonly LocalPoint[],
  radius: number,
) => {
  const subpoints = [] as [number, number][];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const next = points[i + 1];
    const point = points[i];
    const prevIsHorizontal = headingForPointIsHorizontal(point, prev);
    const nextIsHorizontal = headingForPointIsHorizontal(next, point);
    const corner = Math.min(
      radius,
      pointDistance(points[i], next) / 2,
      pointDistance(points[i], prev) / 2,
    );

    if (prevIsHorizontal) {
      if (prev[0] < point[0]) {
        // LEFT
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        // RIGHT
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (prev[1] < point[1]) {
      // UP
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      subpoints.push([points[i][0], points[i][1] + corner]);
    }

    subpoints.push(points[i] as [number, number]);

    if (nextIsHorizontal) {
      if (next[0] < point[0]) {
        // LEFT
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        // RIGHT
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (next[1] < point[1]) {
      // UP
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      // DOWN
      subpoints.push([points[i][0], points[i][1] + corner]);
    }
  }

  const d = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < subpoints.length; i += 3) {
    d.push(`L ${subpoints[i][0]} ${subpoints[i][1]}`);
    d.push(
      `Q ${subpoints[i + 1][0]} ${subpoints[i + 1][1]}, ${
        subpoints[i + 2][0]
      } ${subpoints[i + 2][1]}`,
    );
  }
  d.push(`L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`);

  return d.join(" ");
};

/**
 * get the pure geometric shape of an excalidraw elementw
 * which is then used for hit detection
 */
export const getElementShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GeometricShape<Point> => {
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "frame":
    case "magicframe":
    case "embeddable":
    case "image":
    case "iframe":
    case "text":
    case "selection":
      return getPolygonShape(element);
    case "arrow":
    case "line": {
      const roughShape = ShapeCache.generateElementShape(element, null)[0];
      const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);

      return shouldTestInside(element)
        ? getClosedCurveShape<Point>(
            element,
            roughShape,
            pointFrom<Point>(element.x, element.y),
            element.angle,
            pointFrom(cx, cy),
          )
        : getCurveShape<Point>(
            roughShape,
            pointFrom<Point>(element.x, element.y),
            element.angle,
            pointFrom(cx, cy),
          );
    }

    case "ellipse":
      return getEllipseShape(element);

    case "freedraw": {
      const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);
      return getFreedrawShape(
        element,
        pointFrom(cx, cy),
        shouldTestInside(element),
      );
    }
  }
};

export const toggleLinePolygonState = (
  element: ExcalidrawLineElement,
  nextPolygonState: boolean,
): {
  polygon: ExcalidrawLineElement["polygon"];
  points: ExcalidrawLineElement["points"];
} | null => {
  const updatedPoints = [...element.points];

  if (nextPolygonState) {
    if (!canBecomePolygon(element.points)) {
      return null;
    }

    const firstPoint = updatedPoints[0];
    const lastPoint = updatedPoints[updatedPoints.length - 1];

    const distance = Math.hypot(
      firstPoint[0] - lastPoint[0],
      firstPoint[1] - lastPoint[1],
    );

    if (
      distance > LINE_POLYGON_POINT_MERGE_DISTANCE ||
      updatedPoints.length < 4
    ) {
      updatedPoints.push(pointFrom(firstPoint[0], firstPoint[1]));
    } else {
      updatedPoints[updatedPoints.length - 1] = pointFrom(
        firstPoint[0],
        firstPoint[1],
      );
    }
  }

  // TODO: satisfies ElementUpdate<ExcalidrawLineElement>
  const ret = {
    polygon: nextPolygonState,
    points: updatedPoints,
  };

  return ret;
};

// -----------------------------------------------------------------------------
//                         freedraw shape helper
// -----------------------------------------------------------------------------

const FREEDRAW_DEFAULT_PRESSURE = 0.5;
const FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING = 3;
const FREEDRAW_PRESSURE_SMOOTHING_RADIUS = 6;

// Round to 2 dp — sub-pixel accuracy at SVG 96 dpi
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG path `d` string for a single tapered capsule. Uses clockwise arcs
 * (sweep=1) so the geometry matches the canvas 2D
 * `arc(..., anticlockwise=false)` calls.
 */
const freedrawTaperedCapsulePath = (
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
): string => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const r = Math.max(r0, r1);

  if (len < r / 2) {
    // Degenerate — full circle at midpoint via two clockwise 180° arcs.
    const cx = r2((x0 + x1) / 2);
    const cy = r2((y0 + y1) / 2);
    const rr = r2(r);
    return (
      `M ${(cx - rr).toFixed(2)} ${cy.toFixed(2)} ` +
      `A ${rr} ${rr} 0 1 1 ${(cx + rr).toFixed(2)} ${cy.toFixed(2)} ` +
      `A ${rr} ${rr} 0 1 1 ${(cx - rr).toFixed(2)} ${cy.toFixed(2)} Z`
    );
  }

  const px = -dy / len; // perpendicular unit x
  const py = dx / len; // perpendicular unit y

  // P0 +/- perp·r0  (start / back cap tangent points)
  const b0x = r2(x0 + px * r0);
  const b0y = r2(y0 + py * r0);
  const b1x = r2(x0 - px * r0);
  const b1y = r2(y0 - py * r0);
  // P1 +/- perp·r1  (end / front cap tangent points)
  const f0x = r2(x1 - px * r1);
  const f0y = r2(y1 - py * r1);
  const f1x = r2(x1 + px * r1);
  const f1y = r2(y1 + py * r1);
  const rr0 = r2(r0);
  const rr1 = r2(r1);

  // Back cap: clockwise 180° arc from (b0) to (b1) around P0.
  // Front cap: clockwise 180° arc from (f0) to (f1) around P1.
  return (
    `M ${b0x.toFixed(2)} ${b0y.toFixed(2)} ` +
    `A ${rr0.toFixed(2)} ${rr0.toFixed(2)} 0 1 1 ${b1x.toFixed(
      2,
    )} ${b1y.toFixed(2)} ` +
    `L ${f0x.toFixed(2)} ${f0y.toFixed(2)} ` +
    `A ${rr1.toFixed(2)} ${rr1.toFixed(2)} 0 1 1 ${f1x.toFixed(
      2,
    )} ${f1y.toFixed(2)} Z`
  );
};

/**
 * Catmull-Rom tangent at points[i].Identical math to `getCatmullRomTangent`
 * in renderElement.ts (predictedPoint is not needed for finalised strokes).
 */
const freedrawCatmullRomTangent = (
  points: readonly (readonly [number, number])[],
  i: number,
): [number, number] => {
  const N = points.length;
  const cur = points[i];

  let next: readonly [number, number];
  if (i < N - 1) {
    next = points[i + 1];
  } else {
    const prev2 = i > 0 ? points[i - 1] : cur;
    next = [2 * cur[0] - prev2[0], 2 * cur[1] - prev2[1]];
  }

  let tx: number;
  let ty: number;
  if (i === 0) {
    tx = (next[0] - cur[0]) * 0.5;
    ty = (next[1] - cur[1]) * 0.5;
  } else {
    const prev = points[i - 1];
    tx = (next[0] - prev[0]) * 0.5;
    ty = (next[1] - prev[1]) * 0.5;
  }

  // Chord-length clamping (PCHIP-style).
  const magSq = tx * tx + ty * ty;
  if (magSq > 0) {
    const dNx = next[0] - cur[0];
    const dNy = next[1] - cur[1];
    const chordNext = Math.sqrt(dNx * dNx + dNy * dNy);
    let chordPrev = chordNext;
    if (i > 0) {
      const prev = points[i - 1];
      const dPx = cur[0] - prev[0];
      const dPy = cur[1] - prev[1];
      chordPrev = Math.sqrt(dPx * dPx + dPy * dPy);
    }
    const maxMag = 3 * Math.min(chordNext, chordPrev);
    const mag = Math.sqrt(magSq);
    if (mag > maxMag) {
      const s = maxMag / mag;
      tx *= s;
      ty *= s;
    }
  }

  return [tx, ty];
};

/**
 * Triangular-kernel causal weighted pressure average (backward-only window).
 * When `simulatePressure` is true or pressures array is empty, returns the
 * default constant pressure so the geometry mirrors constant-pressure rendering.
 */
const getFreeDrawSmoothedPressure = (
  element: ExcalidrawFreeDrawElement,
  i: number,
): number => {
  const { pressures } = element;
  if (element.simulatePressure || pressures.length === 0) {
    return FREEDRAW_DEFAULT_PRESSURE;
  }
  let sum = 0;
  let totalWeight = 0;
  for (let k = -FREEDRAW_PRESSURE_SMOOTHING_RADIUS; k <= 0; k++) {
    const idx = i + k;
    if (idx < 0) {
      continue;
    }
    const p =
      idx < pressures.length ? pressures[idx] : FREEDRAW_DEFAULT_PRESSURE;
    const w = FREEDRAW_PRESSURE_SMOOTHING_RADIUS + 1 + k;
    sum += p * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? sum / totalWeight : FREEDRAW_DEFAULT_PRESSURE;
};

/**
 * Returns one SVG path `d` string per tapered-capsule sub-segment for a
 * freedraw element, using the same Catmull-Rom Bezier subdivision and pressure
 * smoothing as the canvas renderer.
 */
const getFreeDrawCapsulePaths = (
  element: ExcalidrawFreeDrawElement,
): SVGPathString[] => {
  const { points } = element;
  const N = points.length;
  const baseRadius = (element.strokeWidth * 1.25) / 2;

  const getSmoothedPressure = (i: number): number =>
    getFreeDrawSmoothedPressure(element, i);

  const paths: SVGPathString[] = [];

  if (N === 1) {
    // Single-point stroke — filled circle.
    const rr = r2(baseRadius * getSmoothedPressure(0) * 2);
    const cx = r2(points[0][0]);
    const cy = r2(points[0][1]);
    paths.push(
      `M ${(cx - rr).toFixed(2)} ${cy.toFixed(2)} A ${rr} ${rr} 0 1 1 ${(
        cx + rr
      ).toFixed(2)} ${cy.toFixed(2)} A ${rr} ${rr} 0 1 1 ${(cx - rr).toFixed(
        2,
      )} ${cy.toFixed(2)} Z` as SVGPathString,
    );
    return paths;
  }

  for (let i = 1; i < N; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const r0 = baseRadius * getSmoothedPressure(i - 1) * 2;
    const r1 = baseRadius * getSmoothedPressure(i) * 2;

    const t0 = freedrawCatmullRomTangent(points, i - 1);
    const t1 = freedrawCatmullRomTangent(points, i);

    // Bezier subdivision.
    const segLen = Math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2);
    const nSubdiv = Math.max(
      1,
      Math.ceil(segLen / FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING),
    );

    const cp1x = p0[0] + t0[0] / 3;
    const cp1y = p0[1] + t0[1] / 3;
    const cp2x = p1[0] - t1[0] / 3;
    const cp2y = p1[1] - t1[1] / 3;

    let prevX = p0[0];
    let prevY = p0[1];
    let prevR = r0;

    for (let k = 1; k <= nSubdiv; k++) {
      const t = k / nSubdiv;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      const mt3 = mt2 * mt;
      const t3 = t2 * t;

      const x =
        mt3 * p0[0] + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * p1[0];
      const y =
        mt3 * p0[1] + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * p1[1];
      const r = r0 + (r1 - r0) * t;

      paths.push(
        freedrawTaperedCapsulePath(
          prevX,
          prevY,
          prevR,
          x,
          y,
          r,
        ) as SVGPathString,
      );
      prevX = x;
      prevY = y;
      prevR = r;
    }
  }

  return paths;
};

/**
 * Generates an outline polygon for a freedraw element using the same
 * Catmull-Rom Bezier subdivision and pressure smoothing as the canvas renderer.
 * Returns `[x, y]` points in element-local coordinates that form a closed
 * polygon around the stroke (left side + right side reversed), suitable for
 * hit-testing and eraser intersection.
 */
export const getFreedrawOutlinePoints = (
  element: ExcalidrawFreeDrawElement,
): [number, number][] => {
  const { points } = element;
  const N = points.length;
  const baseRadius = (element.strokeWidth * 1.25) / 2;

  if (N === 0) {
    return [];
  }

  const radius0 = baseRadius * getFreeDrawSmoothedPressure(element, 0) * 2;

  if (N === 1) {
    // Single point case
    const cx = points[0][0];
    const cy = points[0][1];
    const result: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      result.push([
        cx + Math.cos(angle) * radius0,
        cy + Math.sin(angle) * radius0,
      ]);
    }
    return result;
  }

  const leftPoints: [number, number][] = [];
  const rightPoints: [number, number][] = [];

  for (let i = 1; i < N; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const r0 = baseRadius * getFreeDrawSmoothedPressure(element, i - 1) * 2;
    const r1 = baseRadius * getFreeDrawSmoothedPressure(element, i) * 2;

    const t0 = freedrawCatmullRomTangent(points, i - 1);
    const t1 = freedrawCatmullRomTangent(points, i);

    const segLen = Math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2);
    const nSubdiv = Math.max(
      1,
      Math.ceil(segLen / FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING),
    );

    const cp1x = p0[0] + t0[0] / 3;
    const cp1y = p0[1] + t0[1] / 3;
    const cp2x = p1[0] - t1[0] / 3;
    const cp2y = p1[1] - t1[1] / 3;

    // Include the start point of the first segment.
    const kStart = i === 1 ? 0 : 1;

    for (let k = kStart; k <= nSubdiv; k++) {
      const tParam = k / nSubdiv;
      const mt = 1 - tParam;
      const mt2 = mt * mt;
      const t2 = tParam * tParam;
      const mt3 = mt2 * mt;
      const t3 = t2 * tParam;

      const x =
        mt3 * p0[0] + 3 * mt2 * tParam * cp1x + 3 * mt * t2 * cp2x + t3 * p1[0];
      const y =
        mt3 * p0[1] + 3 * mt2 * tParam * cp1y + 3 * mt * t2 * cp2y + t3 * p1[1];

      // Bezier first derivative for the tangent direction.
      const dtx =
        3 *
        (mt2 * (cp1x - p0[0]) +
          2 * mt * tParam * (cp2x - cp1x) +
          t2 * (p1[0] - cp2x));
      const dty =
        3 *
        (mt2 * (cp1y - p0[1]) +
          2 * mt * tParam * (cp2y - cp1y) +
          t2 * (p1[1] - cp2y));

      const len = Math.sqrt(dtx * dtx + dty * dty);
      if (len === 0) {
        continue;
      }

      // Perpendicular (left = +, right = −).
      const px = -dty / len;
      const py = dtx / len;

      const r = r0 + (r1 - r0) * tParam;

      leftPoints.push([x + px * r, y + py * r]);
      rightPoints.push([x - px * r, y - py * r]);
    }
  }

  // Closed polygon: left side (start -> end) + right side (end -> start).
  return [...leftPoints, ...rightPoints.reverse()];
};

// -----------------------------------------------------------------------------
