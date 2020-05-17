import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement } from "../types";
import { getShapeForElement } from "../../renderer/renderElement";
import { getCommonBounds } from "../bounds";

import Path from "./Path";

function normalizeShape(shape: Drawable) {
  shape.sets = shape.sets
    .filter(({ type }) => type === "path")
    .map((set) => {
      if (shape.shape === "rectangle") {
        // De-duplicated paths
        set.ops = set.ops.filter(({ op }, i) => {
          if (i > 0 && op === "move") {
            return false;
          }
          return i % 4 === 0 || i % 4 === 1;
        });
      }

      return set;
    });

  return shape;
}

function objectToPath(
  rc: RoughCanvas,
  element: ExcalidrawElement,
  {
    offsetX,
    offsetY,
  }: {
    offsetX: number;
    offsetY: number;
  },
) {
  const shape = getShapeForElement(element) as Drawable;
  const normalizedShape = normalizeShape(shape);
  const [p] = rc.generator.toPaths(normalizedShape);

  const path = new Path(p.d);

  path.position([element.x - offsetX, element.y - offsetY]);

  return path;
}

export function differenceElement(
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  rc: RoughCanvas,
): ExcalidrawElement {
  const [offsetX, offsetY] = getCommonBounds([element1, element2]);

  const path1 = objectToPath(rc, element1, {
    offsetX,
    offsetY,
  });
  const path2 = objectToPath(rc, element2, {
    offsetX,
    offsetY,
  });

  const d = path1.difference(path2);

  const element = newPathElement({
    ...element1,
    type: "path",
    d,
  });

  return element;
}
