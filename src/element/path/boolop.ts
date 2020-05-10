import rough from "roughjs/bin/rough";
import { Drawable } from "roughjs/bin/core";

import { ExcalidrawElement } from "../types";
import { randomInteger, randomId } from "../../random";
import { getShapeForElement } from "../../renderer/renderElement";

import Path from "./Path";

function normalizeShape(shape: Drawable) {
  shape.sets = shape.sets
    .filter(({ type }) => type === "path")
    .map((set) => {
      if (shape.shape === "rectangle") {
        // De-duplicated paths
        set.ops = set.ops.filter((_, i) => i % 4 === 0 || i % 4 === 1);
      }

      return set;
    });

  return shape;
}

export function differenceElement(elements: readonly ExcalidrawElement[]) {
  const canvas = document.createElement("canvas");
  const rc = rough.canvas(canvas);

  const shape = getShapeForElement(elements[0]) as Drawable;
  const normalizedShape = normalizeShape(shape);

  const paths = rc.generator.toPaths(normalizedShape);

  const shape2 = getShapeForElement(elements[1]) as Drawable;
  const normalizedShape2 = normalizeShape(shape2);

  const paths2 = rc.generator.toPaths(normalizedShape2);

  const path1 = new Path(paths[0]);
  const path2 = new Path(paths2[0]);
debugger
  console.log(path1.difference(path2));
}
