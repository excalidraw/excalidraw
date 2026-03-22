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
  lineSegment,
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
import { debugDrawLine, debugDrawPoint, debugDrawPolygon } from "./visualdebug";

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

const SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE = 0.3;
const SIMPLE_ROUNDED_ARROW_CP_LENGTH_RATIO = 1 / 4;

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

      // Generate collision ops using the same bisector-based cubic Bézier
      // algorithm as generateRoundedSimpleArrowShape so hit-testing matches rendering.
      const rotateLocal = (lx: number, ly: number): LocalPoint => {
        const g = pointRotateRads<GlobalPoint>(
          pointFrom<GlobalPoint>(element.x + lx, element.y + ly),
          center,
          element.angle,
        );
        return pointFrom<LocalPoint>(g[0] - element.x, g[1] - element.y);
      };

      const collisionOps: Array<{
        op: string;
        data: number[] | LocalPoint;
      }> = [];
      collisionOps.push({
        op: "move",
        data: rotateLocal(points[0][0], points[0][1]),
      });

      if (points.length === 2) {
        collisionOps.push({
          op: "lineTo",
          data: rotateLocal(points[1][0], points[1][1]),
        });
      } else {
        const n = points.length;
        const ptxn = new Float64Array(n);
        const ptyn = new Float64Array(n);

        for (let i = 1; i < n - 1; i++) {
          const inDx = points[i][0] - points[i - 1][0];
          const inDy = points[i][1] - points[i - 1][1];
          const inLen = Math.hypot(inDx, inDy);
          const inUx = inDx / inLen;
          const inUy = inDy / inLen;
          const outDx = points[i + 1][0] - points[i][0];
          const outDy = points[i + 1][1] - points[i][1];
          const outLen = Math.hypot(outDx, outDy);
          const outUx = outDx / outLen;
          const outUy = outDy / outLen;
          const bisDx = inUx + outUx;
          const bisDy = inUy + outUy;
          const bisLen = Math.hypot(bisDx, bisDy);
          let bisUx: number;
          let bisUy: number;
          if (bisLen > 1e-8) {
            bisUx = bisDx / bisLen;
            bisUy = bisDy / bisLen;
          } else {
            bisUx = -inUy;
            bisUy = inUx;
          }
          ptxn[i] = bisUx;
          ptyn[i] = bisUy;
        }

        // Endpoints: reflect the adjacent interior tangent across the
        // endpoint's chord with specific dampening
        {
          const cx = points[1][0] - points[0][0];
          const cy = points[1][1] - points[0][1];
          const cLen = Math.hypot(cx, cy);
          const cux = cx / cLen;
          const cuy = cy / cLen;
          const dot = ptxn[1] * cux + ptyn[1] * cuy;
          const rx =
            (1 + SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE) * dot * cux -
            SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE * ptxn[1];
          const ry =
            (1 + SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE) * dot * cuy -
            SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE * ptyn[1];
          const rLen = Math.hypot(rx, ry);
          ptxn[0] = rx / rLen;
          ptyn[0] = ry / rLen;
        }
        {
          const cx = points[n - 1][0] - points[n - 2][0];
          const cy = points[n - 1][1] - points[n - 2][1];
          const cLen = Math.hypot(cx, cy);
          const cux = cx / cLen;
          const cuy = cy / cLen;
          const dot = ptxn[n - 2] * cux + ptyn[n - 2] * cuy;
          const rx =
            (1 + SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE) * dot * cux -
            SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE * ptxn[n - 2];
          const ry =
            (1 + SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE) * dot * cuy -
            SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE * ptyn[n - 2];
          const rLen = Math.hypot(rx, ry);
          ptxn[n - 1] = rx / rLen;
          ptyn[n - 1] = ry / rLen;
        }

        for (let i = 0; i < n - 1; i++) {
          const d =
            pointDistance(points[i], points[i + 1]) *
            SIMPLE_ROUNDED_ARROW_CP_LENGTH_RATIO;
          const cp1x = points[i][0] + ptxn[i] * d;
          const cp1y = points[i][1] + ptyn[i] * d;
          const cp2x = points[i + 1][0] - ptxn[i + 1] * d;
          const cp2y = points[i + 1][1] - ptyn[i + 1] * d;

          const rcp1 = rotateLocal(cp1x, cp1y);
          const rcp2 = rotateLocal(cp2x, cp2y);
          const rend = rotateLocal(points[i + 1][0], points[i + 1][1]);

          collisionOps.push({
            op: "bcurveTo",
            data: [rcp1[0], rcp1[1], rcp2[0], rcp2[1], rend[0], rend[1]],
          });
        }
      }
      return collisionOps;
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
            generateRoundedSimpleArrowShape(points),
            generateRoughOptions(element, true, isDarkMode),
          ),
        ];
        if (window.visualDebug?.data) {
          debugRoundedArrowControlPoints(element.x, element.y, points);
        }
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

/**
 * Debug helper to visualise chord and control points.
 *
 * Chords are grey, CP1 handles/circles are green, CP2 handles/diamonds are blue,
 * segment points are red X markers.
 */
const debugRoundedArrowControlPoints = (
  elementX: number,
  elementY: number,
  points: readonly LocalPoint[],
) => {
  const n = points.length;
  if (n < 2) {
    return;
  }

  const g = (lx: number, ly: number): GlobalPoint =>
    pointFrom<GlobalPoint>(elementX + lx, elementY + ly);

  const PERMANENT = { permanent: true } as const;
  const CP_RADIUS = 5;
  const DIAMOND_RADIUS = 6;

  const txn = new Float64Array(n);
  const tyn = new Float64Array(n);

  for (let i = 1; i < n - 1; i++) {
    const inDx = points[i][0] - points[i - 1][0];
    const inDy = points[i][1] - points[i - 1][1];
    const inLen = Math.hypot(inDx, inDy);
    const inUx = inDx / inLen;
    const inUy = inDy / inLen;

    const outDx = points[i + 1][0] - points[i][0];
    const outDy = points[i + 1][1] - points[i][1];
    const outLen = Math.hypot(outDx, outDy);
    const outUx = outDx / outLen;
    const outUy = outDy / outLen;

    const bisDx = inUx + outUx;
    const bisDy = inUy + outUy;
    const bisLen = Math.hypot(bisDx, bisDy);
    let bisUx: number;
    let bisUy: number;
    if (bisLen > 1e-8) {
      bisUx = bisDx / bisLen;
      bisUy = bisDy / bisLen;
    } else {
      bisUx = -inUy;
      bisUy = inUx;
    }

    const bx = bisUx;
    const by = bisUy;
    const bLen = Math.hypot(bx, by);
    txn[i] = bx / bLen;
    tyn[i] = by / bLen;
  }

  // Endpoints: reflect the adjacent interior tangent across the endpoint's own chord.
  {
    const cx = points[1][0] - points[0][0];
    const cy = points[1][1] - points[0][1];
    const cLen = Math.hypot(cx, cy);
    const cux = cx / cLen;
    const cuy = cy / cLen;
    const dot = txn[1] * cux + tyn[1] * cuy;
    const eas = SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE;
    const rx = (1 + eas) * dot * cux - eas * txn[1];
    const ry = (1 + eas) * dot * cuy - eas * tyn[1];
    const rLen = Math.hypot(rx, ry);
    txn[0] = rx / rLen;
    tyn[0] = ry / rLen;
  }
  {
    const cx = points[n - 1][0] - points[n - 2][0];
    const cy = points[n - 1][1] - points[n - 2][1];
    const cLen = Math.hypot(cx, cy);
    const cux = cx / cLen;
    const cuy = cy / cLen;
    const dot = txn[n - 2] * cux + tyn[n - 2] * cuy;
    const eas = SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE;
    const rx = (1 + eas) * dot * cux - eas * txn[n - 2];
    const ry = (1 + eas) * dot * cuy - eas * tyn[n - 2];
    const rLen = Math.hypot(rx, ry);
    txn[n - 1] = rx / rLen;
    tyn[n - 1] = ry / rLen;
  }

  for (let i = 0; i < n - 1; i++) {
    const d =
      Math.hypot(
        points[i + 1][0] - points[i][0],
        points[i + 1][1] - points[i][1],
      ) * SIMPLE_ROUNDED_ARROW_CP_LENGTH_RATIO;
    const p0 = g(points[i][0], points[i][1]);
    const p1 = g(points[i + 1][0], points[i + 1][1]);
    const cp1 = g(points[i][0] + txn[i] * d, points[i][1] + tyn[i] * d);
    const cp2 = g(
      points[i + 1][0] - txn[i + 1] * d,
      points[i + 1][1] - tyn[i + 1] * d,
    );

    // chord (grey)
    debugDrawLine(lineSegment(p0, p1), { color: "#888888", ...PERMANENT });

    // CP1 handle + circle (green = outgoing from p0)
    debugDrawLine(lineSegment(p0, cp1), {
      color: "#00cc44",
      ...PERMANENT,
    });
    debugDrawPolygon(
      Array.from({ length: 9 }, (_, k) =>
        pointFrom<GlobalPoint>(
          cp1[0] + Math.cos((k * Math.PI) / 4) * CP_RADIUS,
          cp1[1] + Math.sin((k * Math.PI) / 4) * CP_RADIUS,
        ),
      ),
      { color: "#00cc44", close: true, ...PERMANENT },
    );

    // CP2 handle + diamond (blue = incoming to p1)
    debugDrawLine(lineSegment(p1, cp2), { color: "#0088ff", ...PERMANENT });
    debugDrawPolygon(
      [
        pointFrom<GlobalPoint>(cp2[0], cp2[1] - DIAMOND_RADIUS),
        pointFrom<GlobalPoint>(cp2[0] + DIAMOND_RADIUS, cp2[1]),
        pointFrom<GlobalPoint>(cp2[0], cp2[1] + DIAMOND_RADIUS),
        pointFrom<GlobalPoint>(cp2[0] - DIAMOND_RADIUS, cp2[1]),
      ],
      { color: "#0088ff", close: true, ...PERMANENT },
    );
  }

  // Segment points: red X
  for (let i = 0; i < n; i++) {
    debugDrawPoint(g(points[i][0], points[i][1]), {
      color: "#ff3333",
      ...PERMANENT,
    });
  }
};

const generateRoundedSimpleArrowShape = (
  points: readonly LocalPoint[],
): string => {
  if (points.length < 2) {
    return "";
  }

  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  const n = points.length;
  const txn = new Float64Array(n);
  const tyn = new Float64Array(n);

  for (let i = 1; i < n - 1; i++) {
    const inDx = points[i][0] - points[i - 1][0];
    const inDy = points[i][1] - points[i - 1][1];
    const inLen = Math.hypot(inDx, inDy);
    const inUx = inDx / inLen;
    const inUy = inDy / inLen;

    const outDx = points[i + 1][0] - points[i][0];
    const outDy = points[i + 1][1] - points[i][1];
    const outLen = Math.hypot(outDx, outDy);
    const outUx = outDx / outLen;
    const outUy = outDy / outLen;

    // Bisector: average of the two incident unit chord vectors
    const bisDx = inUx + outUx;
    const bisDy = inUy + outUy;
    const bisLen = Math.hypot(bisDx, bisDy);
    let bisUx: number;
    let bisUy: number;
    if (bisLen > 1e-8) {
      bisUx = bisDx / bisLen;
      bisUy = bisDy / bisLen;
    } else {
      // 180° hairpin -> rotate incoming chord 90°
      bisUx = -inUy;
      bisUy = inUx;
    }

    const bx = bisUx;
    const by = bisUy;
    const bLen = Math.hypot(bx, by);
    txn[i] = bx / bLen;
    tyn[i] = by / bLen;
  }

  // Endpoints: reflect the adjacent interior tangent across the endpoint's own chord.
  // This mirrors the angle the interior CP makes with the chord, preventing overshoot.
  // ENDPOINT_ANGLE_SCALE < 1 reduces the perpendicular deviation, making endpoints more taut.
  {
    const cx = points[1][0] - points[0][0];
    const cy = points[1][1] - points[0][1];
    const cLen = Math.hypot(cx, cy);
    const cux = cx / cLen;
    const cuy = cy / cLen;
    const dot = txn[1] * cux + tyn[1] * cuy;
    const eas = SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE;
    const rx = (1 + eas) * dot * cux - eas * txn[1];
    const ry = (1 + eas) * dot * cuy - eas * tyn[1];
    const rLen = Math.hypot(rx, ry);
    txn[0] = rx / rLen;
    tyn[0] = ry / rLen;
  }
  {
    const cx = points[n - 1][0] - points[n - 2][0];
    const cy = points[n - 1][1] - points[n - 2][1];
    const cLen = Math.hypot(cx, cy);
    const cux = cx / cLen;
    const cuy = cy / cLen;
    const dot = txn[n - 2] * cux + tyn[n - 2] * cuy;
    const eas = SIMPLE_ROUNDED_ARROW_ENDPOINT_ANGLE_SCALE;
    const rx = (1 + eas) * dot * cux - eas * txn[n - 2];
    const ry = (1 + eas) * dot * cuy - eas * tyn[n - 2];
    const rLen = Math.hypot(rx, ry);
    txn[n - 1] = rx / rLen;
    tyn[n - 1] = ry / rLen;
  }

  const path: string[] = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < n - 1; i++) {
    const d =
      Math.hypot(
        points[i + 1][0] - points[i][0],
        points[i + 1][1] - points[i][1],
      ) * SIMPLE_ROUNDED_ARROW_CP_LENGTH_RATIO;
    const cp1x = points[i][0] + txn[i] * d;
    const cp1y = points[i][1] + tyn[i] * d;
    const cp2x = points[i + 1][0] - txn[i + 1] * d;
    const cp2y = points[i + 1][1] - tyn[i + 1] * d;
    path.push(
      `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${points[i + 1][0]} ${
        points[i + 1][1]
      }`,
    );
  }

  return path.join(" ");
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
