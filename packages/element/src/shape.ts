import { simplify } from "points-on-curve";
import { getStroke } from "perfect-freehand";

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

import type { GlobalPoint } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import type {
  AppState,
  EmbedsValidationStatus,
} from "@excalidraw/excalidraw/types";
import type {
  ElementShape,
  ElementShapes,
  SVGPathString,
} from "@excalidraw/excalidraw/scene/types";

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
  getArrowheadPoints,
  getCenterForBounds,
  getDiamondPoints,
  getElementAbsoluteCoords,
} from "./bounds";
import { shouldTestInside } from "./collision";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
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
    stroke: isDarkMode
      ? applyDarkModeFilter(element.strokeColor)
      : element.strokeColor,
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
        : isDarkMode
        ? applyDarkModeFilter(element.backgroundColor)
        : element.backgroundColor;
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
            : isDarkMode
            ? applyDarkModeFilter(element.backgroundColor)
            : element.backgroundColor;
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
  element: NonDeletedExcalidrawElement,
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

  const strokeColor = isDarkMode
    ? applyDarkModeFilter(element.strokeColor)
    : element.strokeColor;
  const backgroundFillColor = isDarkMode
    ? applyDarkModeFilter(canvasBackgroundColor)
    : canvasBackgroundColor;
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
) => {
  const generator = new RoughGenerator();
  const options: Options = {
    seed: element.seed,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    roughness: 0,
    preserveVertices: true,
  };
  const center = getCenterForBounds(
    // Need a non-rotated center point
    element.points.reduce(
      (acc, point) => {
        return [
          Math.min(element.x + point[0], acc[0]),
          Math.min(element.y + point[1], acc[1]),
          Math.max(element.x + point[0], acc[2]),
          Math.max(element.y + point[1], acc[3]),
        ];
      },
      [Infinity, Infinity, -Infinity, -Infinity],
    ),
  );

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

      // Rotate the same cubic ops used for rendering so hit-testing matches the
      // visible arrow path.
      const rotateLocal = (lx: number, ly: number): LocalPoint => {
        const g = pointRotateRads<GlobalPoint>(
          pointFrom<GlobalPoint>(element.x + lx, element.y + ly),
          center,
          element.angle,
        );
        return pointFrom<LocalPoint>(g[0] - element.x, g[1] - element.y);
      };

      return generateSimpleArrowPathOps(points, 0.5, element.id).map((op) => {
        if (op.op === "bcurveTo") {
          const rcp1 = rotateLocal(op.data[0], op.data[1]);
          const rcp2 = rotateLocal(op.data[2], op.data[3]);
          const rend = rotateLocal(op.data[4], op.data[5]);

          return {
            op: "bcurveTo",
            data: [rcp1[0], rcp1[1], rcp2[0], rcp2[1], rend[0], rend[1]],
          };
        }

        return {
          op: op.op,
          data: rotateLocal(op.data[0], op.data[1]),
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
  element: Exclude<NonDeletedExcalidrawElement, ExcalidrawSelectionElement>,
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
        shape = [
          generator.path(
            generateSimpleArrowShape(points, 0.5, element.id),
            generateRoughOptions(element, true, isDarkMode),
          ),
        ];
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
      shapes.push(getFreeDrawSvgPath(element));

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

type SimpleArrowPathOp =
  | { op: "move" | "lineTo"; data: LocalPoint }
  | { op: "bcurveTo"; data: [number, number, number, number, number, number] };

const SIMPLE_ARROW_OVERSHOOT_EPSILON = 0.5;
const SIMPLE_ARROW_SCALE_EPSILON = 1e-4;
const SIMPLE_ARROW_SCALE_SEARCH_STEPS = 24;
const SIMPLE_ARROW_SCALE_PASSES = 8;

type SimpleArrowVector = [number, number];

type SimpleArrowTangentOverrides = Record<
  string,
  Record<number, SimpleArrowVector>
>;

declare global {
  interface Window {
    EXCALIDRAW_DEBUG_LINEAR_ARROW_TANGENT_OVERRIDES?:
      | SimpleArrowTangentOverrides
      | undefined;
  }
}

type SimpleArrowCurveDebugDataOptions = {
  elementId?: string;
};

export type SimpleArrowCurveDebugData<
  Point extends GlobalPoint | LocalPoint = LocalPoint,
> = {
  elementId?: string;
  tangents: Array<{
    point: Point;
    base: SimpleArrowVector;
    autoScaled: SimpleArrowVector;
    scale: number;
    autoScale: number;
    scaled: SimpleArrowVector;
    isAdjusted: boolean;
    isOverridden: boolean;
    normalized: {
      baseLength: number;
      autoLength: number;
      finalLength: number;
      prevSegmentLength: number | null;
      nextSegmentLength: number | null;
      minNeighborLength: number | null;
      finalLengthVsMinNeighbor: number | null;
      autoLengthVsMinNeighbor: number | null;
      angleDelta: number;
      turnAngle: number | null;
    };
  }>;
  segments: Array<{
    start: Point;
    end: Point;
    baseCp1: Point;
    baseCp2: Point;
    cp1: Point;
    cp2: Point;
    overshootsBaseline: boolean;
    overshootsResolved: boolean;
    metrics: {
      chordLength: number;
      baseStartProjection: number;
      baseEndProjection: number;
      finalStartProjection: number;
      finalEndProjection: number;
    };
  }>;
  inference: {
    overriddenPointIndices: number[];
  };
};

const SIMPLE_ARROW_ADJUSTMENT_EPSILON = 1e-3;

const getSimpleArrowTangentOverrideStore = () => {
  if (typeof window === "undefined") {
    return null;
  }

  window.EXCALIDRAW_DEBUG_LINEAR_ARROW_TANGENT_OVERRIDES ??= {};
  return window.EXCALIDRAW_DEBUG_LINEAR_ARROW_TANGENT_OVERRIDES;
};

export const setSimpleArrowTangentOverride = (
  elementId: string,
  pointIndex: number,
  tangent: SimpleArrowVector,
) => {
  const store = getSimpleArrowTangentOverrideStore();

  if (!store) {
    return;
  }

  store[elementId] = {
    ...(store[elementId] ?? {}),
    [pointIndex]: [tangent[0], tangent[1]],
  };
};

export const clearSimpleArrowTangentOverride = (
  elementId: string,
  pointIndex?: number,
) => {
  const store = getSimpleArrowTangentOverrideStore();

  if (!store?.[elementId]) {
    return;
  }

  if (typeof pointIndex === "number") {
    delete store[elementId][pointIndex];

    if (Object.keys(store[elementId]).length === 0) {
      delete store[elementId];
    }
    return;
  }

  delete store[elementId];
};

const getSimpleArrowTangentOverrides = (elementId?: string) => {
  if (!elementId) {
    return null;
  }

  return getSimpleArrowTangentOverrideStore()?.[elementId] ?? null;
};

const getSimpleArrowVectorLength = ([x, y]: SimpleArrowVector) =>
  Math.hypot(x, y);

const normalizeSimpleArrowAngle = (angle: number) => {
  let normalized = angle;

  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  return normalized;
};

const getSimpleArrowBezierValue = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
) => {
  const mt = 1 - t;

  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
};

const doesSimpleArrowSegmentOvershoot = (
  startProjection: number,
  endProjection: number,
  segmentLength: number,
) => {
  const a = -3 * startProjection + 3 * endProjection + segmentLength;
  const b = 2 * (segmentLength - 2 * endProjection + startProjection);
  const c = startProjection;
  const candidateTs = [0, 1];

  if (Math.abs(a) < 1e-8) {
    if (Math.abs(b) >= 1e-8) {
      candidateTs.push(-c / b);
    }
  } else {
    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
      const discriminantRoot = Math.sqrt(discriminant);
      candidateTs.push((-b + discriminantRoot) / (2 * a));
      candidateTs.push((-b - discriminantRoot) / (2 * a));
    }
  }

  let minProjection = Infinity;
  let maxProjection = -Infinity;

  for (const t of candidateTs) {
    if (t < 0 || t > 1) {
      continue;
    }

    const projection = getSimpleArrowBezierValue(
      0,
      startProjection,
      endProjection,
      segmentLength,
      t,
    );

    minProjection = Math.min(minProjection, projection);
    maxProjection = Math.max(maxProjection, projection);
  }

  return (
    minProjection < -SIMPLE_ARROW_OVERSHOOT_EPSILON ||
    maxProjection > segmentLength + SIMPLE_ARROW_OVERSHOOT_EPSILON
  );
};

const getSimpleArrowBaseTangents = <Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
  tension: number,
): [Float64Array, Float64Array] => {
  const tx = new Float64Array(points.length);
  const ty = new Float64Array(points.length);

  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      const pbx = 3 * points[0][0] - 3 * points[1][0] + points[2][0];
      const pby = 3 * points[0][1] - 3 * points[1][1] + points[2][1];
      tx[i] = tension * (points[1][0] - pbx);
      ty[i] = tension * (points[1][1] - pby);
    } else if (i === points.length - 1) {
      const pax =
        3 * points[points.length - 1][0] -
        3 * points[points.length - 2][0] +
        points[points.length - 3][0];
      const pay =
        3 * points[points.length - 1][1] -
        3 * points[points.length - 2][1] +
        points[points.length - 3][1];
      tx[i] = tension * (pax - points[points.length - 2][0]);
      ty[i] = tension * (pay - points[points.length - 2][1]);
    } else {
      tx[i] = tension * (points[i + 1][0] - points[i - 1][0]);
      ty[i] = tension * (points[i + 1][1] - points[i - 1][1]);
    }
  }

  return [tx, ty];
};

const getSimpleArrowSegmentProjections = <
  Point extends GlobalPoint | LocalPoint,
>(
  points: readonly Point[],
  tangentX: Float64Array,
  tangentY: Float64Array,
  scales: Float64Array | undefined,
  segmentIndex: number,
  segmentScale = 1,
) => {
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const segmentDx = end[0] - start[0];
  const segmentDy = end[1] - start[1];
  const segmentLength = Math.hypot(segmentDx, segmentDy);

  if (!segmentLength) {
    return {
      segmentLength,
      startProjection: 0,
      endProjection: 0,
    };
  }

  const segmentUx = segmentDx / segmentLength;
  const segmentUy = segmentDy / segmentLength;
  const startScale = scales?.[segmentIndex] ?? 1;
  const endScale = scales?.[segmentIndex + 1] ?? 1;
  const startProjection =
    startScale *
    segmentScale *
    ((tangentX[segmentIndex] * segmentUx + tangentY[segmentIndex] * segmentUy) /
      3);
  const endProjection =
    segmentLength -
    endScale *
      segmentScale *
      ((tangentX[segmentIndex + 1] * segmentUx +
        tangentY[segmentIndex + 1] * segmentUy) /
        3);

  return {
    segmentLength,
    startProjection,
    endProjection,
  };
};

const isSimpleArrowSegmentOvershooting = <
  Point extends GlobalPoint | LocalPoint,
>(
  points: readonly Point[],
  tangentX: Float64Array,
  tangentY: Float64Array,
  scales: Float64Array | undefined,
  segmentIndex: number,
  segmentScale = 1,
) => {
  const { segmentLength, startProjection, endProjection } =
    getSimpleArrowSegmentProjections(
      points,
      tangentX,
      tangentY,
      scales,
      segmentIndex,
      segmentScale,
    );

  if (!segmentLength) {
    return false;
  }

  return doesSimpleArrowSegmentOvershoot(
    startProjection,
    endProjection,
    segmentLength,
  );
};

const getSimpleArrowSegmentScale = <Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
  tx: Float64Array,
  ty: Float64Array,
  scales: Float64Array,
  segmentIndex: number,
) => {
  if (
    !isSimpleArrowSegmentOvershooting(points, tx, ty, scales, segmentIndex, 1)
  ) {
    return 1;
  }

  let low = 0;
  let high = 1;

  for (let i = 0; i < SIMPLE_ARROW_SCALE_SEARCH_STEPS; i++) {
    const mid = (low + high) / 2;
    if (
      isSimpleArrowSegmentOvershooting(
        points,
        tx,
        ty,
        scales,
        segmentIndex,
        mid,
      )
    ) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return low;
};

const getSimpleArrowTangentScales = <Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
  tx: Float64Array,
  ty: Float64Array,
) => {
  const scales = new Float64Array(points.length);
  scales.fill(1);

  for (let pass = 0; pass < SIMPLE_ARROW_SCALE_PASSES; pass++) {
    const nextScales = new Float64Array(scales);
    let didChange = false;

    for (
      let segmentIndex = 0;
      segmentIndex < points.length - 1;
      segmentIndex++
    ) {
      if (
        !isSimpleArrowSegmentOvershooting(points, tx, ty, scales, segmentIndex)
      ) {
        continue;
      }

      const segmentScale = getSimpleArrowSegmentScale(
        points,
        tx,
        ty,
        scales,
        segmentIndex,
      );

      const nextStartScale = scales[segmentIndex] * segmentScale;
      const nextEndScale = scales[segmentIndex + 1] * segmentScale;

      if (
        nextStartScale <
        nextScales[segmentIndex] - SIMPLE_ARROW_SCALE_EPSILON
      ) {
        nextScales[segmentIndex] = nextStartScale;
        didChange = true;
      }

      if (
        nextEndScale <
        nextScales[segmentIndex + 1] - SIMPLE_ARROW_SCALE_EPSILON
      ) {
        nextScales[segmentIndex + 1] = nextEndScale;
        didChange = true;
      }
    }

    if (!didChange) {
      return scales;
    }

    scales.set(nextScales);
  }

  return scales;
};

const getSimpleArrowFinalTangents = (
  tx: Float64Array,
  ty: Float64Array,
  scales: Float64Array,
  elementId?: string,
) => {
  const finalX = new Float64Array(tx.length);
  const finalY = new Float64Array(ty.length);

  for (let i = 0; i < tx.length; i++) {
    finalX[i] = tx[i] * scales[i];
    finalY[i] = ty[i] * scales[i];
  }

  const overrides = getSimpleArrowTangentOverrides(elementId);

  if (!overrides) {
    return {
      finalX,
      finalY,
      overriddenPointIndices: [] as number[],
    };
  }

  const overriddenPointIndices: number[] = [];

  for (const [indexKey, tangent] of Object.entries(overrides)) {
    const index = Number(indexKey);

    if (!Number.isInteger(index) || index < 0 || index >= finalX.length) {
      continue;
    }

    finalX[index] = tangent[0];
    finalY[index] = tangent[1];
    overriddenPointIndices.push(index);
  }

  overriddenPointIndices.sort((a, b) => a - b);

  return {
    finalX,
    finalY,
    overriddenPointIndices,
  };
};

export const getSimpleArrowCurveDebugData = <
  Point extends GlobalPoint | LocalPoint,
>(
  points: readonly Point[],
  tension = 0.5,
  options?: SimpleArrowCurveDebugDataOptions,
): SimpleArrowCurveDebugData<Point> => {
  if (points.length < 2) {
    return {
      elementId: options?.elementId,
      tangents: [],
      segments: [],
      inference: {
        overriddenPointIndices: [],
      },
    };
  }

  if (points.length === 2) {
    return {
      elementId: options?.elementId,
      tangents: points.map((point) => ({
        point,
        base: [0, 0],
        autoScaled: [0, 0],
        scale: 1,
        autoScale: 1,
        scaled: [0, 0],
        isAdjusted: false,
        isOverridden: false,
        normalized: {
          baseLength: 0,
          autoLength: 0,
          finalLength: 0,
          prevSegmentLength: null,
          nextSegmentLength: null,
          minNeighborLength: null,
          finalLengthVsMinNeighbor: null,
          autoLengthVsMinNeighbor: null,
          angleDelta: 0,
          turnAngle: null,
        },
      })),
      segments: [],
      inference: {
        overriddenPointIndices: [],
      },
    };
  }

  const [tx, ty] = getSimpleArrowBaseTangents(points, tension);
  const scales = getSimpleArrowTangentScales(points, tx, ty);
  const baselineScales = new Float64Array(points.length);
  baselineScales.fill(1);
  const { finalX, finalY, overriddenPointIndices } =
    getSimpleArrowFinalTangents(tx, ty, scales, options?.elementId);

  return {
    elementId: options?.elementId,
    tangents: points.map((point, index) => ({
      point,
      base: [tx[index], ty[index]],
      autoScaled: [tx[index] * scales[index], ty[index] * scales[index]],
      scale:
        getSimpleArrowVectorLength([tx[index], ty[index]]) > 0
          ? getSimpleArrowVectorLength([finalX[index], finalY[index]]) /
            getSimpleArrowVectorLength([tx[index], ty[index]])
          : 1,
      autoScale: scales[index],
      scaled: [finalX[index], finalY[index]],
      isAdjusted:
        Math.abs(scales[index] - 1) > SIMPLE_ARROW_ADJUSTMENT_EPSILON ||
        Math.abs(
          normalizeSimpleArrowAngle(
            Math.atan2(finalY[index], finalX[index]) -
              Math.atan2(ty[index], tx[index]),
          ),
        ) > SIMPLE_ARROW_ADJUSTMENT_EPSILON,
      isOverridden: overriddenPointIndices.includes(index),
      normalized: (() => {
        const base = [tx[index], ty[index]] as SimpleArrowVector;
        const autoScaled = [
          tx[index] * scales[index],
          ty[index] * scales[index],
        ] as SimpleArrowVector;
        const scaled = [finalX[index], finalY[index]] as SimpleArrowVector;
        const baseLength = getSimpleArrowVectorLength(base);
        const autoLength = getSimpleArrowVectorLength(autoScaled);
        const finalLength = getSimpleArrowVectorLength(scaled);
        const prevSegmentLength =
          index > 0 ? pointDistance(points[index - 1], point) : null;
        const nextSegmentLength =
          index < points.length - 1
            ? pointDistance(point, points[index + 1])
            : null;
        const minNeighborLength =
          prevSegmentLength === null
            ? nextSegmentLength
            : nextSegmentLength === null
            ? prevSegmentLength
            : Math.min(prevSegmentLength, nextSegmentLength);
        const turnAngle =
          prevSegmentLength !== null && nextSegmentLength !== null
            ? normalizeSimpleArrowAngle(
                Math.atan2(
                  points[index + 1][1] - point[1],
                  points[index + 1][0] - point[0],
                ) -
                  Math.atan2(
                    point[1] - points[index - 1][1],
                    point[0] - points[index - 1][0],
                  ),
              )
            : null;

        return {
          baseLength,
          autoLength,
          finalLength,
          prevSegmentLength,
          nextSegmentLength,
          minNeighborLength,
          finalLengthVsMinNeighbor:
            minNeighborLength && minNeighborLength > 0
              ? finalLength / minNeighborLength
              : null,
          autoLengthVsMinNeighbor:
            minNeighborLength && minNeighborLength > 0
              ? autoLength / minNeighborLength
              : null,
          angleDelta: normalizeSimpleArrowAngle(
            Math.atan2(finalY[index], finalX[index]) -
              Math.atan2(ty[index], tx[index]),
          ),
          turnAngle,
        };
      })(),
    })),
    segments: points.slice(0, -1).map((start, index) => {
      const end = points[index + 1];
      const {
        segmentLength: chordLength,
        startProjection: baseStartProjection,
        endProjection: baseEndProjection,
      } = getSimpleArrowSegmentProjections(
        points,
        tx,
        ty,
        baselineScales,
        index,
      );
      const {
        startProjection: finalStartProjection,
        endProjection: finalEndProjection,
      } = getSimpleArrowSegmentProjections(
        points,
        finalX,
        finalY,
        undefined,
        index,
      );
      const baseCp1 = pointFrom<Point>(
        start[0] + tx[index] / 3,
        start[1] + ty[index] / 3,
      );
      const baseCp2 = pointFrom<Point>(
        end[0] - tx[index + 1] / 3,
        end[1] - ty[index + 1] / 3,
      );
      const cp1 = pointFrom<Point>(
        start[0] + finalX[index] / 3,
        start[1] + finalY[index] / 3,
      );
      const cp2 = pointFrom<Point>(
        end[0] - finalX[index + 1] / 3,
        end[1] - finalY[index + 1] / 3,
      );

      return {
        start,
        end,
        baseCp1,
        baseCp2,
        cp1,
        cp2,
        overshootsBaseline: isSimpleArrowSegmentOvershooting(
          points,
          tx,
          ty,
          baselineScales,
          index,
        ),
        overshootsResolved: isSimpleArrowSegmentOvershooting(
          points,
          finalX,
          finalY,
          undefined,
          index,
        ),
        metrics: {
          chordLength,
          baseStartProjection,
          baseEndProjection,
          finalStartProjection,
          finalEndProjection,
        },
      };
    }),
    inference: {
      overriddenPointIndices,
    },
  };
};

const generateSimpleArrowPathOps = (
  points: readonly LocalPoint[],
  tension = 0.5,
  elementId?: string,
): SimpleArrowPathOp[] => {
  if (points.length < 2) {
    return [];
  }

  const ops: SimpleArrowPathOp[] = [
    {
      op: "move",
      data: pointFrom<LocalPoint>(points[0][0], points[0][1]),
    },
  ];

  if (points.length === 2) {
    ops.push({
      op: "lineTo",
      data: pointFrom<LocalPoint>(points[1][0], points[1][1]),
    });

    return ops;
  }
  const debugData = getSimpleArrowCurveDebugData(points, tension, {
    elementId,
  });

  for (const segment of debugData.segments) {
    const { cp1, cp2, end } = segment;

    ops.push({
      op: "bcurveTo",
      data: [cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1]],
    });
  }

  return ops;
};

const generateSimpleArrowShape = (
  points: readonly LocalPoint[],
  tension = 0.5,
  elementId?: string,
): string => {
  return generateSimpleArrowPathOps(points, tension, elementId)
    .map((op) => {
      if (op.op === "bcurveTo") {
        return `C ${op.data[0]} ${op.data[1]} ${op.data[2]} ${op.data[3]} ${op.data[4]} ${op.data[5]}`;
      }

      return `${op.op === "move" ? "M" : "L"} ${op.data[0]} ${op.data[1]}`;
    })
    .join(" ");
};

const generateElbowArrowShape = (
  points: readonly LocalPoint[],
  radius: number,
): string => {
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

// NOTE not cached (-> for SVG export)
const getFreeDrawSvgPath = (element: ExcalidrawFreeDrawElement) => {
  return getSvgPathFromStroke(
    getFreedrawOutlinePoints(element),
  ) as SVGPathString;
};

export const getFreedrawOutlinePoints = (
  element: ExcalidrawFreeDrawElement,
) => {
  // If input points are empty (should they ever be?) return a dot
  const inputPoints = element.simulatePressure
    ? element.points
    : element.points.length
    ? element.points.map(([x, y], i) => [x, y, element.pressures[i]])
    : [[0, 0, 0.5]];

  return getStroke(inputPoints as number[][], {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => Math.sin((t * Math.PI) / 2), // https://easings.net/#easeOutSine
    last: true,
  }) as [number, number][];
};

const med = (A: number[], B: number[]) => {
  return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
};

// Trim SVG path data so number are each two decimal points. This
// improves SVG exports, and prevents rendering errors on points
// with long decimals.
const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

const getSvgPathFromStroke = (points: number[][]): string => {
  if (!points.length) {
    return "";
  }

  const max = points.length - 1;

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
};

// -----------------------------------------------------------------------------
