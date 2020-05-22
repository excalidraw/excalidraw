import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "../types";
import { generateShape } from "../../renderer/renderElement";
import { getCommonBounds } from "../bounds";

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
  options: {
    position?: number[];
  } = {},
) {
  const shape = generateShape(
    {
      ...element,
      roughness: 0,
    } as NonDeletedExcalidrawElement,
    rc.generator,
  ) as Drawable;
  const normalizedShape = normalizeShape(shape);
  const [p] = rc.generator.toPaths(normalizedShape);

  const path = new Path(p.d);
  if (options.position) {
    path.position(options.position);
  }

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

  const path1 = objectToPath(rc, element1, {
    position: p1,
  });
  const path2 = objectToPath(rc, element2, {
    position: p2,
  });

  path1.difference(path2);

  path1.position(p1.map((c) => -c));

  const element = newPathElement({
    ...element1,
    type: "path",
    d: path1.toPathString(),
    hollow: path1.isHollow,
  });

  return element;
}
