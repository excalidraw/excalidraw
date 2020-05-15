import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement } from "../types";
import { getShapeForElement } from "../../renderer/renderElement";
import { getCommonBounds } from "../bounds";

import Path from "./Path";

function normalizeShape(shape: Drawable) {
  // shape.sets = shape.sets
  //   .filter(({ type }) => type === "path")
  //   .map((set) => {
  //     if (shape.shape === "rectangle") {
  //       // De-duplicated paths
  //       set.ops = set.ops.filter((_, i) => i % 4 === 0 || i % 4 === 1);
  //     }

  //     return set;
  //   });

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
  d?: string,
  x?: number,
  y?: number,
) {
  const shape = getShapeForElement(element) as Drawable;
  const normalizedShape = normalizeShape(shape);
  const [p] = rc.generator.toPaths(normalizedShape);

  const path = new Path(d || p.d);

  path.position([x || element.x - offsetX, y || element.y - offsetY]);

  return path;
}

export function differenceElement(
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  rc: RoughCanvas,
): ExcalidrawElement {
  const [offsetX, offsetY] = getCommonBounds([element1, element2]);

  const path1 = objectToPath(
    rc,
    element1,
    {
      offsetX,
      offsetY,
    },
    "M0 0 C56.56924173980951 0, 113.13848347961903 0, 208 0 M208 0 C208 53.917935302015394, 208 107.83587060403079, 208 155 M208 155 C129.78222415298222 155, 51.56444830596445 155, 0 155 M0 155 C0 112.48919997597113, 0 69.97839995194227, 0 0",
    10,
    10,
  );
  const path2 = objectToPath(
    rc,
    element2,
    {
      offsetX,
      offsetY,
    },
    "M0 0 C46.915581312496215 0, 93.83116262499243 0, 135 0 M135 0 C135 29.14559708507732, 135 58.29119417015464, 135 103 M135 103 C97.6203742059879 103, 60.2407484119758 103, 0 103 M0 103 C0 70.6234093519859, 0 38.2468187039718, 0 0",
    153,
    115,
  );

  const element = newPathElement({
    ...element1,
    type: "path",
    d: path1.difference(path2),
  });

  return element;
}
