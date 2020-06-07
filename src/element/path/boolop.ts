import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "../types";
import { generateShape } from "../../renderer/renderElement";
import { getCommonBounds, getElementBounds } from "../bounds";
import { radianToDegree } from "../../math";

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

export function differenceElement(
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  rc: RoughCanvas,
): ExcalidrawElement {
  const [offsetX, offsetY] = getCommonBounds([element1, element2]);
  const p1 = [element1.x - offsetX, element1.y - offsetY];
  const p2 = [element2.x - offsetX, element2.y - offsetY];
  const d1 = radianToDegree(element1.angle);
  const d2 = radianToDegree(element2.angle);

  const path1 = objectToPath(rc, element1, {
    translate: p1,
    rotate: d1,
  });
  const path2 = objectToPath(rc, element2, {
    translate: p2,
    rotate: d2,
  });

  path1.difference(path2);

  path1.transform({
    rotate: -d1,
  });

  const box = path1.getBoundingBox();

  path1.transform({
    translate: [-box.x, -box.y],
  });

  const element = newPathElement({
    ...element1,
    width: box.width,
    height: box.height,
    d: path1.toPathString(),
    hollow: path1.isHollow,
  });

  // const [x0, y0, x1, y1] = getElementBounds(element1);
  // const [x2, y2, x3, y3] = getElementBounds(elem);

  // const element = newPathElement({
  //   ...elem,
  //   x: element1.x + (x2 - x0),
  //   y: element1.y + (y2 - y0),
  // });

  return element;
}
