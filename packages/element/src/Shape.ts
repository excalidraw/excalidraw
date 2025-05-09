import { simplify } from "points-on-curve";

import {
  pointFrom,
  pointDistance,
  type LocalPoint,
  pointRotateRads,
  type GlobalPoint,
  curve,
  degreesToRadians,
  pointFromArray,
} from "@excalidraw/math";
import {
  ROUGHNESS,
  isTransparent,
  assertNever,
  elementCenterPoint,
  invariant,
} from "@excalidraw/common";

import { RoughGenerator } from "roughjs/bin/generator";

import {
  debugClear,
  debugDrawBounds,
  debugDrawLine,
  debugDrawPoint,
} from "@excalidraw/excalidraw/visualdebug";

import { getCurvePathOps } from "@excalidraw/utils/shape";

import type { Degrees, Radians } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { EmbedsValidationStatus } from "@excalidraw/excalidraw/types";
import type { ElementShapes } from "@excalidraw/excalidraw/scene/types";

import {
  isElbowArrow,
  isEmbeddableElement,
  isIframeElement,
  isIframeLikeElement,
  isLinearElement,
} from "./typeChecks";
import { getCornerRadius, isPathALoop } from "./shapes";
import { headingForPointIsHorizontal } from "./heading";

import { canChangeRoundness } from "./comparisons";
import { generateFreeDrawShape } from "./renderElement";
import {
  aabbForCubicBezierCurve,
  aabbForElement,
  getArrowheadPoints,
  getCubicBezierCurveBound,
  getDiamondPoints,
  getElementBounds,
} from "./bounds";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  ExcalidrawSelectionElement,
  ExcalidrawLinearElement,
  Arrowhead,
  ExcalidrawFreeDrawElement,
} from "./types";

import type { Drawable, Options } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";

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
    stroke: element.strokeColor,
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

const getArrowheadShapes = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
  generator: RoughGenerator,
  options: Options,
  canvasBackgroundColor: string,
) => {
  const arrowheadPoints = getArrowheadPoints(
    element,
    shape,
    position,
    arrowhead,
  );

  if (arrowheadPoints === null) {
    return [];
  }

  const generateCrowfootOne = (
    arrowheadPoints: number[] | null,
    options: Options,
  ) => {
    if (arrowheadPoints === null) {
      return [];
    }

    const [, , x3, y3, x4, y4] = arrowheadPoints;

    return [generator.line(x3, y3, x4, y4, options)];
  };

  switch (arrowhead) {
    case "dot":
    case "circle":
    case "circle_outline": {
      const [x, y, diameter] = arrowheadPoints;

      // always use solid stroke for arrowhead
      delete options.strokeLineDash;

      return [
        generator.circle(x, y, diameter, {
          ...options,
          fill:
            arrowhead === "circle_outline"
              ? canvasBackgroundColor
              : element.strokeColor,

          fillStyle: "solid",
          stroke: element.strokeColor,
          roughness: Math.min(0.5, options.roughness || 0),
        }),
      ];
    }
    case "triangle":
    case "triangle_outline": {
      const [x, y, x2, y2, x3, y3] = arrowheadPoints;

      // always use solid stroke for arrowhead
      delete options.strokeLineDash;

      return [
        generator.polygon(
          [
            [x, y],
            [x2, y2],
            [x3, y3],
            [x, y],
          ],
          {
            ...options,
            fill:
              arrowhead === "triangle_outline"
                ? canvasBackgroundColor
                : element.strokeColor,
            fillStyle: "solid",
            roughness: Math.min(1, options.roughness || 0),
          },
        ),
      ];
    }
    case "diamond":
    case "diamond_outline": {
      const [x, y, x2, y2, x3, y3, x4, y4] = arrowheadPoints;

      // always use solid stroke for arrowhead
      delete options.strokeLineDash;

      return [
        generator.polygon(
          [
            [x, y],
            [x2, y2],
            [x3, y3],
            [x4, y4],
            [x, y],
          ],
          {
            ...options,
            fill:
              arrowhead === "diamond_outline"
                ? canvasBackgroundColor
                : element.strokeColor,
            fillStyle: "solid",
            roughness: Math.min(1, options.roughness || 0),
          },
        ),
      ];
    }
    case "crowfoot_one":
      return generateCrowfootOne(arrowheadPoints, options);
    case "bar":
    case "arrow":
    case "crowfoot_many":
    case "crowfoot_one_or_many":
    default: {
      const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;

      if (element.strokeStyle === "dotted") {
        // for dotted arrows caps, reduce gap to make it more legible
        const dash = getDashArrayDotted(element.strokeWidth - 1);
        options.strokeLineDash = [dash[0], dash[1] - 1];
      } else {
        // for solid/dashed, keep solid arrow cap
        delete options.strokeLineDash;
      }
      options.roughness = Math.min(1, options.roughness || 0);
      return [
        generator.line(x3, y3, x2, y2, options),
        generator.line(x4, y4, x2, y2, options),
        ...(arrowhead === "crowfoot_one_or_many"
          ? generateCrowfootOne(
              getArrowheadPoints(element, shape, position, "crowfoot_one"),
              options,
            )
          : []),
      ];
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

  switch (element.type) {
    case "line":
    case "arrow": {
      if (isElbowArrow(element)) {
        const points = element.points.length
          ? element.points
          : [pointFrom<LocalPoint>(0, 0)];

        return generator.path(generateElbowArrowShape(points, 16), options)
          .sets[0].ops;
      } else if (!element.roundness) {
        // Sharp linear line

        let [xs, ys] = element.points.reduce<[number[], number[]]>(
          (acc, point) => {
            acc[0].push(element.x + point[0]);
            acc[1].push(element.y + point[1]);
            return acc;
          },
          [[], []],
        );

        if (element.angle !== 0) {
          const cx =
            (Math.min(...xs, element.x) + Math.max(...xs, element.x)) / 2;
          const cy =
            (Math.min(...ys, element.y) + Math.max(...ys, element.y)) / 2;
          const cos = Math.cos(element.angle);
          const sin = Math.sin(element.angle);

          [xs, ys] = [
            xs.map((x, i) => (x - cx) * cos - (ys[i] - cy) * sin + cx),
            ys.map((y, i) => (xs[i] - cx) * sin + (y - cy) * cos + cy),
          ];
        }

        const points = element.points.length
          ? xs.map((x, i) =>
              pointFrom<LocalPoint>(x - element.x, ys[i] - element.y),
            )
          : [pointFrom<LocalPoint>(0, 0)];

        return points.map((point, idx) => ({
          op: idx === 0 ? "move" : "lineTo",
          data: point,
        }));
      }

      // Ronded lines

      const shape = generator
        .curve(element.points as unknown as RoughPoint[], options)
        .sets[0].ops.slice(0, element.points.length);
      const bounds = getElementBounds(element, new Map());
      debugDrawBounds(bounds, { color: "red", permanent: true });
      debugDrawPoint(pointFrom<GlobalPoint>(bounds[0], bounds[1]), {
        color: "yellow",
        permanent: true,
      });
      debugDrawPoint(pointFrom<GlobalPoint>(bounds[2], bounds[3]), {
        color: "yellow",
        permanent: true,
      });
      const center = pointFrom<GlobalPoint>(
        (bounds[2] + bounds[0]) / 2,
        (bounds[3] + bounds[1]) / 2,
      );

      debugDrawPoint(center, { color: "blue", permanent: true });

      return shape.map((c, i) => {
        if (i === 0) {
          const p = pointRotateRads(
            pointFrom<GlobalPoint>(
              element.x + c.data[0],
              element.y + c.data[1],
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
                element.x + c.data[0],
                element.y + c.data[1],
              ),
              center,
              element.angle,
            ),
            pointRotateRads(
              pointFrom<GlobalPoint>(
                element.x + c.data[2],
                element.y + c.data[3],
              ),
              center,
              element.angle,
            ),
            pointRotateRads(
              pointFrom<GlobalPoint>(
                element.x + c.data[4],
                element.y + c.data[5],
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
      const simplifiedPoints = simplify(
        element.points as Mutable<LocalPoint[]>,
        0.75,
      );

      return generator
        .curve(simplifiedPoints as [number, number][], options)
        .sets[0].ops.slice(0, element.points.length);
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
export const _generateElementShape = (
  element: Exclude<NonDeletedExcalidrawElement, ExcalidrawSelectionElement>,
  generator: RoughGenerator,
  {
    isExporting,
    canvasBackgroundColor,
    embedsValidationStatus,
  }: {
    isExporting: boolean;
    canvasBackgroundColor: string;
    embedsValidationStatus: EmbedsValidationStatus | null;
  },
): Drawable | Drawable[] | null => {
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
          generateRoughOptions(element, true),
        );
      } else {
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          generateRoughOptions(element),
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
        generateRoughOptions(element),
      );
      return shape;
    }
    case "line":
    case "arrow": {
      let shape: ElementShapes[typeof element.type];
      const options = generateRoughOptions(element);

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
              generateRoughOptions(element, true),
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
          );
          shape.push(...shapes);
        }
      }
      return shape;
    }
    case "freedraw": {
      let shape: ElementShapes[typeof element.type];
      generateFreeDrawShape(element);

      if (isPathALoop(element.points)) {
        // generate rough polygon to fill freedraw shape
        const simplifiedPoints = simplify(
          element.points as Mutable<LocalPoint[]>,
          0.75,
        );
        shape = generator.curve(simplifiedPoints as [number, number][], {
          ...generateRoughOptions(element),
          stroke: "none",
        });
      } else {
        shape = null;
      }
      return shape;
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

/** @returns number in pixels */
const getArrowheadSize = (arrowhead: Arrowhead): number => {
  switch (arrowhead) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "crowfoot_many":
    case "crowfoot_one":
    case "crowfoot_one_or_many":
      return 20;
    default:
      return 15;
  }
};

/** @returns number in degrees */
const getArrowheadAngle = (arrowhead: Arrowhead): Degrees => {
  switch (arrowhead) {
    case "bar":
      return 90 as Degrees;
    case "arrow":
      return 20 as Degrees;
    default:
      return 25 as Degrees;
  }
};

const getArrowheadPoints = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
) => {
  if (shape.length < 1) {
    return null;
  }

  const ops = getCurvePathOps(shape[0]);
  if (ops.length < 1) {
    return null;
  }

  // The index of the bCurve operation to examine.
  const index = position === "start" ? 1 : ops.length - 1;

  const data = ops[index].data;

  invariant(data.length === 6, "Op data length is not 6");

  const p3 = pointFrom(data[4], data[5]);
  const p2 = pointFrom(data[2], data[3]);
  const p1 = pointFrom(data[0], data[1]);

  // We need to find p0 of the bezier curve.
  // It is typically the last point of the previous
  // curve; it can also be the position of moveTo operation.
  const prevOp = ops[index - 1];
  let p0 = pointFrom(0, 0);
  if (prevOp.op === "move") {
    const p = pointFromArray(prevOp.data);
    invariant(p != null, "Op data is not a point");
    p0 = p;
  } else if (prevOp.op === "bcurveTo") {
    p0 = pointFrom(prevOp.data[4], prevOp.data[5]);
  }

  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // Ee know the last point of the arrow (or the first, if start arrowhead).
  const [x2, y2] = position === "start" ? p0 : p3;

  // By using cubic bezier equation (B(t)) and the given parameters,
  // we calculate a point that is closer to the last point.
  // The value 0.3 is chosen arbitrarily and it works best for all
  // the tested cases.
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];

  // Find the normalized direction vector based on the
  // previously calculated points.
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance;
  const ny = (y2 - y1) / distance;

  const size = getArrowheadSize(arrowhead);

  let length = 0;

  {
    // Length for -> arrows is based on the length of the last section
    const [cx, cy] =
      position === "end"
        ? element.points[element.points.length - 1]
        : element.points[0];
    const [px, py] =
      element.points.length > 1
        ? position === "end"
          ? element.points[element.points.length - 2]
          : element.points[1]
        : [0, 0];

    length = Math.hypot(cx - px, cy - py);
  }

  // Scale down the arrowhead until we hit a certain size so that it doesn't look weird.
  // This value is selected by minimizing a minimum size with the last segment of the arrowhead
  const lengthMultiplier =
    arrowhead === "diamond" || arrowhead === "diamond_outline" ? 0.25 : 0.5;
  const minSize = Math.min(size, length * lengthMultiplier);
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  if (
    arrowhead === "dot" ||
    arrowhead === "circle" ||
    arrowhead === "circle_outline"
  ) {
    const diameter = Math.hypot(ys - y2, xs - x2) + element.strokeWidth - 2;
    return [x2, y2, diameter];
  }

  const angle = getArrowheadAngle(arrowhead);

  if (arrowhead === "crowfoot_many" || arrowhead === "crowfoot_one_or_many") {
    // swap (xs, ys) with (x2, y2)
    const [x3, y3] = pointRotateRads(
      pointFrom(x2, y2),
      pointFrom(xs, ys),
      degreesToRadians(-angle as Degrees),
    );
    const [x4, y4] = pointRotateRads(
      pointFrom(x2, y2),
      pointFrom(xs, ys),
      degreesToRadians(angle),
    );
    return [xs, ys, x3, y3, x4, y4];
  }

  // Return points
  const [x3, y3] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    ((-angle * Math.PI) / 180) as Radians,
  );
  const [x4, y4] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    degreesToRadians(angle),
  );

  if (arrowhead === "diamond" || arrowhead === "diamond_outline") {
    // point opposite to the arrowhead point
    let ox;
    let oy;

    if (position === "start") {
      const [px, py] = element.points.length > 1 ? element.points[1] : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(x2 + minSize * 2, y2),
        pointFrom(x2, y2),
        Math.atan2(py - y2, px - x2) as Radians,
      );
    } else {
      const [px, py] =
        element.points.length > 1
          ? element.points[element.points.length - 2]
          : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(x2 - minSize * 2, y2),
        pointFrom(x2, y2),
        Math.atan2(y2 - py, x2 - px) as Radians,
      );
    }

    return [x2, y2, x3, y3, ox, oy, x4, y4];
  }

  return [x2, y2, x3, y3, x4, y4];
};
