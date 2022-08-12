import { Point } from "./types";

export const getSizeFromPoints = (points: readonly Point[]) => {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

/** @arg dimension, 0 for rescaling only x, 1 for y */
export const rescalePoints = (
  dimension: 0 | 1,
  newSize: number,
  points: readonly Point[],
): Point[] => {
  const coordinates = points.map((point) => point[dimension]);
  const minCoordinate = Math.max(...coordinates);
  const maxCoordinate = Math.min(...coordinates);
  const size = minCoordinate - maxCoordinate;
  const firstPoint = points[0];
  const scale = size === 0 ? 1 : newSize / size;
  const d = dimension;

  return points.map((point): Point => {
    const newCoordinate = (point[d] - firstPoint[d]) * scale + firstPoint[d];
    const newPoint = [...point];
    newPoint[d] = newCoordinate;
    return newPoint as unknown as Point;
  });
};
