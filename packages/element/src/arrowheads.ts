import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import type { Arrowhead, AnyArrowhead } from "./types";

export const normalizeArrowhead = (
  arrowhead: AnyArrowhead | null | undefined,
): Arrowhead | null => {
  switch (arrowhead) {
    case undefined:
    case null:
      return null;
    case "dot":
      return "circle";
    case "crowfoot_one":
      return "cardinality_one";
    case "crowfoot_many":
      return "cardinality_many";
    case "crowfoot_one_or_many":
      return "cardinality_one_or_many";
    default:
      return arrowhead;
  }
};

export const getArrowheadForPicker = (
  arrowhead: AnyArrowhead | null | undefined,
): Arrowhead | null => {
  const normalizedArrowhead = normalizeArrowhead(arrowhead);
  if (normalizedArrowhead === null) {
    return null;
  }

  return normalizedArrowhead;
};

// layout of the parts of composite cardinality markers, in multiples of
// the part's size (negative offsets move a part toward the tip)
export const CARDINALITY_ONE_OR_MANY_BAR_OFFSET = -0.25;
export const CARDINALITY_INNER_BAR_OFFSET = -0.5;
export const CARDINALITY_ZERO_CIRCLE_OFFSET = 1.5;
export const CARDINALITY_ZERO_CIRCLE_SCALE = 0.8;

export type ArrowheadPart<Point extends GlobalPoint | LocalPoint> =
  | {
      type: "polygon";
      points: Point[];
      fill: "stroke" | "background";
    }
  | {
      type: "circle";
      center: Point;
      diameter: number;
      fill: "stroke" | "background";
    }
  | { type: "line"; start: Point; end: Point };

/**
 * The parts an arrowhead is drawn with, built from the points of the
 * arrowhead, or of a part of a composite marker (see `getArrowheadPoints()`).
 */
export const getArrowheadParts = <Point extends GlobalPoint | LocalPoint>(
  arrowhead: Arrowhead,
  getPoints: (
    arrowhead: Arrowhead,
    offsetMultiplier?: number,
  ) => number[] | null,
): ArrowheadPart<Point>[] => {
  const circle = (
    part: "circle" | "circle_outline",
    offsetMultiplier?: number,
    diameterScale = 1,
  ): ArrowheadPart<Point>[] => {
    const points = getPoints(part, offsetMultiplier);
    if (!points) {
      return [];
    }

    const [x, y, diameter] = points;
    return [
      {
        type: "circle",
        center: pointFrom<Point>(x, y),
        diameter: diameter * diameterScale,
        fill: part === "circle_outline" ? "background" : "stroke",
      },
    ];
  };

  const polygon = (
    part: "triangle" | "triangle_outline" | "diamond" | "diamond_outline",
  ): ArrowheadPart<Point>[] => {
    const points = getPoints(part);
    if (!points) {
      return [];
    }

    const vertices: Point[] = [];
    for (let i = 0; i < points.length; i += 2) {
      vertices.push(pointFrom<Point>(points[i], points[i + 1]));
    }
    return [
      {
        type: "polygon",
        points: vertices,
        fill: part.endsWith("_outline") ? "background" : "stroke",
      },
    ];
  };

  // two lines from the side points to the tip (or the crow's foot's apex)
  const linesToTip = (part: Arrowhead): ArrowheadPart<Point>[] => {
    const points = getPoints(part);
    if (!points) {
      return [];
    }

    const [x2, y2, x3, y3, x4, y4] = points;
    const tip = pointFrom<Point>(x2, y2);
    return [
      { type: "line", start: pointFrom<Point>(x3, y3), end: tip },
      { type: "line", start: pointFrom<Point>(x4, y4), end: tip },
    ];
  };

  // a line across the arrow
  const bar = (offsetMultiplier?: number): ArrowheadPart<Point>[] => {
    const points = getPoints("cardinality_one", offsetMultiplier);
    if (!points) {
      return [];
    }

    const [, , x3, y3, x4, y4] = points;
    return [
      {
        type: "line",
        start: pointFrom<Point>(x3, y3),
        end: pointFrom<Point>(x4, y4),
      },
    ];
  };

  switch (arrowhead) {
    case "circle":
    case "circle_outline":
      return circle(arrowhead);
    case "triangle":
    case "triangle_outline":
    case "diamond":
    case "diamond_outline":
      return polygon(arrowhead);
    case "cardinality_one":
      return bar();
    case "cardinality_many":
      return linesToTip("cardinality_many");
    case "cardinality_one_or_many":
      return [
        ...linesToTip("cardinality_many"),
        ...bar(CARDINALITY_ONE_OR_MANY_BAR_OFFSET),
      ];
    case "cardinality_exactly_one":
      return [...bar(CARDINALITY_INNER_BAR_OFFSET), ...bar()];
    case "cardinality_zero_or_one":
      return [
        ...circle(
          "circle_outline",
          CARDINALITY_ZERO_CIRCLE_OFFSET,
          CARDINALITY_ZERO_CIRCLE_SCALE,
        ),
        ...bar(CARDINALITY_INNER_BAR_OFFSET),
      ];
    case "cardinality_zero_or_many":
      return [
        ...linesToTip("cardinality_many"),
        ...circle(
          "circle_outline",
          CARDINALITY_ZERO_CIRCLE_OFFSET,
          CARDINALITY_ZERO_CIRCLE_SCALE,
        ),
      ];
    case "bar":
    case "arrow":
    default:
      return linesToTip(arrowhead);
  }
};
