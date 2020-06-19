import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "../types";
import { BoundingPoints, Point } from "../../types";
import { generateShape } from "../../renderer/renderElement";
import {
  getElementBounds,
  getElementBoudingPoints,
  getElementAbsoluteCoords,
} from "../bounds";
import { radianToDegree } from "../../math";
import { isPointInsidePath } from "./R";

import Path from "./Path";

function normalizeShape(shape: Drawable) {
  shape.sets = shape.sets
    .filter(({ type }) => type === "path")
    .map((set) => {
      if (["rectangle", "polygon"].includes(shape.shape)) {
        // De-duplicated paths
        set.ops = set.ops.filter((_, i) => {
          return i === 0 || i % 4 === 1;
        });
      } else if (shape.shape === "ellipse") {
        set.ops = set.ops.slice(
          0,
          set.ops.findIndex(({ op }, i) => i > 0 && op === "move"),
        );

        const last = set.ops.pop();

        // close the path
        if (last) {
          set.ops.push({
            ...last,
            data: [
              ...last.data.slice(0, last.data.length - 2),
              ...set.ops[0].data,
            ],
          });
        }
      }

      return set;
    });

  return shape;
}

function objectToPath(
  rc: RoughCanvas,
  element: ExcalidrawElement,
  transform?: {
    translate?: number[];
    rotate?: number;
  },
) {
  const shape = generateShape(
    {
      ...element,
      roughness: 0,
    } as NonDeletedExcalidrawElement,
    rc.generator,
  ) as Drawable;
  let path = null;

  if (element.type !== "path") {
    switch (element.type) {
      case "ellipse":
        path = new Path(element);
        break;

      default:
        const normalizedShape = normalizeShape(shape);
        const [p] = rc.generator.toPaths(normalizedShape);

        path = new Path(p.d);
    }
  } else {
    path = new Path(element.d);
  }

  path.transform(transform);

  return path;
}

// get bounding points that is not touched
function getExcludedBoundingPoints(
  path: Path,
  point: Point,
  boundingPoints: BoundingPoints,
): {
  [key: string]: Point;
} {
  const points: {
    [key: string]: Point;
  } = {};

  Object.keys(boundingPoints).forEach((key) => {
    const p: Point = boundingPoints[key];

    if (!isPointInsidePath(path.path, p[0] - point[0], p[1] - point[1])) {
      points[key] = p;
    }
  });

  return points;
}

export function differenceElement(
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  rc: RoughCanvas,
): ExcalidrawElement {
  const [x1, y1] = getElementBounds(element1);
  const [x2, y2] = getElementBounds(element2);
  const [x3, y3, x4, y4] = getElementAbsoluteCoords(element2);
  const cx = (x3 + x4) / 2;
  const cy = (y3 + y4) / 2;

  const offsetX = Math.min(x1, x2);
  const offsetY = Math.min(y1, y2);

  const d1 = radianToDegree(element1.angle);
  const d2 = radianToDegree(element2.angle);

  const path1 = objectToPath(rc, element1, {
    translate: [element1.x - offsetX, element1.y - offsetY],
    rotate: d1,
  });
  const path2 = objectToPath(rc, element2, {
    translate: [element2.x - offsetX, element2.y - offsetY],
    rotate: d2,
  });

  const bp1 = getElementBoudingPoints(element1);

  const excludedPoints = getExcludedBoundingPoints(path2, [offsetX, offsetY], bp1);
  const keys = Object.keys(excludedPoints);

  path1.difference(path2);

  path1.transform({
    rotate: -d1,
  });

  const box = path1.getBoundingBox();

  path1.transform({
    translate: [-box.x, -box.y],
  });

  const temp = newPathElement({
    ...element1,
    width: box.width,
    height: box.height,
    d: path1.toPathString(),
    hollow: path1.isHollow,
  });

  const key = keys[0];
  const bpt = getElementBoudingPoints(temp, rc);

  const element = newPathElement({
    ...temp,
    x: temp.x + excludedPoints[key][0] - bpt[key][0],
    y: temp.y + excludedPoints[key][1] - bpt[key][1],
  });

  return element;
}
