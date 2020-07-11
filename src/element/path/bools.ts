import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "../types";
import { Point } from "../../types";
import { generateElementShape } from "../../renderer/renderElement";
import { getElementBounds, getElementAbsoluteCoords } from "../bounds";
import { radianToDegree, rotate } from "../../math";

import Path from "./Path";

function normalizeShape(shape: Drawable) {
  shape.sets = shape.sets
    .filter(({ type }) => type === "path")
    .map((set) => {
      // De-duplicated paths
      switch (shape.shape) {
        case "ellipse":
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
          break;
        case "curve":
          set.ops = set.ops.slice(
            0,
            set.ops.findIndex(({ op }, i) => i > 0 && op === "move"),
          );
          break;
        default:
          set.ops = set.ops.filter((_, i) => {
            return i === 0 || i % 4 === 1;
          });
      }

      return set;
    });

  return shape;
}

function objectToPath(rc: RoughCanvas, element: ExcalidrawElement) {
  const shape = generateElementShape(
    {
      ...element,
      roughness: 0,
    } as NonDeletedExcalidrawElement,
    rc.generator,
  );
  let path = null;

  if (element.type !== "path") {
    switch (element.type) {
      case "ellipse":
        path = new Path(element);
        break;
      case "line": {
        const normalizedShape = normalizeShape((shape as Drawable[])[0]);

        const [p] = rc.generator.toPaths(normalizedShape);

        path = new Path(p.d);

        break;
      }
      default:
        const normalizedShape = normalizeShape(shape as Drawable);

        const [p] = rc.generator.toPaths(normalizedShape);

        path = new Path(p.d);
    }
  } else {
    path = new Path(element.d);
  }

  return path;
}

function curveToPoint(move: Point, element: ExcalidrawElement): Point {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const transformXY = (x: number, y: number) =>
    rotate(element.x + x, element.y + y, cx, cy, element.angle);

  return transformXY(...move);
}

function findIndex(path: Path, move: Point) {
  return path.data.findIndex(
    (c) => c[c.length - 2] === move[0] && c[c.length - 1] === move[1],
  );
}

function getShiftXY(
  originPaths: [Path, Path],
  paths: [Path, Path],
): { move: Point; moveIndex: number; pathIndex: number } {
  let move: Point = [0, 0];
  let moveIndex: number = -1;
  const pathIndex: number = 0;

  for (let i = 0; i < 2; i++) {
    const path = paths[i];

    for (let j = 0; j < path.data.length; j++) {
      const seg = path.data[j];
      move = [seg[seg.length - 2], seg[seg.length - 1]] as [number, number];
      moveIndex = findIndex(originPaths[i], move);

      if (moveIndex !== -1) {
        return {
          move,
          moveIndex,
          pathIndex: i,
        };
      }
    }
  }

  return {
    move,
    moveIndex,
    pathIndex,
  };
}

export function operateBool(
  element1: NonDeletedExcalidrawElement,
  element2: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  action: "difference" | "union" | "intersection" | "exclusion",
): NonDeletedExcalidrawElement {
  const [x1, y1] = getElementBounds(element1);
  const [x2, y2] = getElementBounds(element2);

  const offsetX = Math.min(x1, x2);
  const offsetY = Math.min(y1, y2);

  const transform1 = {
    translate: [element1.x - offsetX, element1.y - offsetY],
    rotate: radianToDegree(element1.angle),
  };
  const transform2 = {
    translate: [element2.x - offsetX, element2.y - offsetY],
    rotate: radianToDegree(element2.angle),
  };

  const path1 = objectToPath(rc, element1);
  const path2 = objectToPath(rc, element2);

  const paths: [Path, Path] = [path1, path2];
  const elements: [ExcalidrawElement, ExcalidrawElement] = [element1, element2];
  const transforms = [transform1, transform2];

  paths.forEach((p, i) => p.transform(transforms[i]));

  const originPaths: [Path, Path] = [Path.clone(path1), Path.clone(path2)];

  const [intersection] = path1[action](path2);

  if (!path1.data.length) {
    return (null as unknown) as NonDeletedExcalidrawElement;
  }

  let move: Point = [0, 0];
  let moveIndex: number = -1;
  let pathIndex: number = 0;

  if (intersection) {
    move = [intersection.x, intersection.y];
    moveIndex = findIndex(path1, move);
  } else {
    ({ move, moveIndex, pathIndex } = getShiftXY(originPaths, paths));
  }

  const isPath2InsidePath1 =
    !intersection &&
    path1.data[0][1] === path2.data[0][1] &&
    path1.data[0][2] === path2.data[0][2];
  const element = elements[pathIndex];
  const transform = transforms[pathIndex];

  path1.transform({
    rotate: -transform.rotate,
  });

  const box = path1.getBoundingBox();

  path1.transform({
    translate: [-box.x, -box.y],
  });

  const temp = newPathElement({
    ...element,
    width: box.width,
    height: box.height,
    d: path1.toPathString(),
    hollow: path1.isHollow,
  });

  let [p1x, p1y] = [0, 0];
  let [p2x, p2y] = [0, 0];

  if (!isPath2InsidePath1) {
    [p1x, p1y] = curveToPoint(
      originPaths[pathIndex].transformPoint(move, {
        translate: transform.translate.map((p) => -p),
        rotate: -transform.rotate,
      }),
      element,
    );
    [p2x, p2y] = curveToPoint(
      paths[pathIndex].data[moveIndex].slice(-2) as [number, number],
      temp,
    );
  }

  return newPathElement({
    ...temp,
    x: temp.x - (p2x - p1x),
    y: temp.y - (p2y - p1y),
  });
}
