import { ExcalidrawElement } from "../element/types";
import { isTextElement } from "../element/typeChecks";
import {
  getDiamondPoints,
  getArrowPoints,
  getLinePoints
} from "../element/bounds";
import { RoughCanvas } from "roughjs/bin/canvas";
import { Drawable } from "roughjs/bin/core";
import { Point } from "roughjs/bin/geometry";

export function renderElement(
  element: ExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D
) {
  const generator = rc.generator;
  if (element.type === "selection") {
    const fillStyle = context.fillStyle;
    context.fillStyle = "rgba(0, 0, 255, 0.10)";
    context.fillRect(0, 0, element.width, element.height);
    context.fillStyle = fillStyle;
  } else if (element.type === "rectangle") {
    if (!element.shape) {
      element.shape = generator.rectangle(0, 0, element.width, element.height, {
        stroke: element.strokeColor,
        fill:
          element.backgroundColor === "transparent"
            ? undefined
            : element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        roughness: element.roughness,
        seed: element.seed
      });
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (element.type === "diamond") {
    if (!element.shape) {
      const [
        topX,
        topY,
        rightX,
        rightY,
        bottomX,
        bottomY,
        leftX,
        leftY
      ] = getDiamondPoints(element);
      element.shape = generator.polygon(
        [
          [topX, topY],
          [rightX, rightY],
          [bottomX, bottomY],
          [leftX, leftY]
        ],
        {
          stroke: element.strokeColor,
          fill:
            element.backgroundColor === "transparent"
              ? undefined
              : element.backgroundColor,
          fillStyle: element.fillStyle,
          strokeWidth: element.strokeWidth,
          roughness: element.roughness,
          seed: element.seed
        }
      );
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (element.type === "ellipse") {
    if (!element.shape) {
      element.shape = generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        {
          stroke: element.strokeColor,
          fill:
            element.backgroundColor === "transparent"
              ? undefined
              : element.backgroundColor,
          fillStyle: element.fillStyle,
          strokeWidth: element.strokeWidth,
          roughness: element.roughness,
          seed: element.seed,
          curveFitting: 1
        }
      );
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (element.type === "arrow") {
    const options = {
      stroke: element.strokeColor,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness,
      seed: element.seed
    };

    // points array can be empty in the beginning, so it is important to add
    // initial position to it
    const points =
      element.points.length > 0 ? element.points : ([[0, 0]] as Point[]);

    if (!element.shape) {
      const [x2, y2, x3, y3, x4, y4] = getArrowPoints(element);

      element.shape = [
        //    \
        generator.line(x3, y3, x2, y2, options),
        // generate lines
        generator.curve(points),
        //    /
        generator.line(x4, y4, x2, y2, options)
      ];
    }

    if (element.isSelected) {
      // draw segment endpoints when element is selected
      points.forEach(p => {
        rc.ellipse(p[0], p[1], 10, 10, {
          fillStyle: "solid",
          fill: "#ffffff",
          strokeWidth: 2,
          roughness: 0
        });
      });
    }

    // debug here
    // REMOVE after done
    {
      const shape = element.shape as Drawable[];

      let p0: Point;

      shape[1].sets[0].ops.forEach(({ op, data }) => {
        if (op === "move") {
          p0 = data as Point;
        } else if (op === "bcurveTo") {
          const p1 = [data[0], data[1]] as Point;
          const p2 = [data[2], data[3]] as Point;
          const p3 = [data[4], data[5]] as Point;

          const equation = (t: number, idx: number) =>
            Math.pow(1 - t, 3) * p3[idx] +
            3 * t * Math.pow(1 - t, 2) * p2[idx] +
            3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
            p0[idx] * Math.pow(t, 3);

          let t = 0;
          while (t <= 1.0) {
            const x = equation(t, 0);
            const y = equation(t, 1);
            rc.ellipse(x, y, 10, 10, {
              fillStyle: "solid",
              fill:
                (parseFloat(t.toFixed(2)) * 10) % 2 === 0
                  ? "#ff0000"
                  : "#00ff00",
              strokeWidth: 2,
              roughness: 0
            });
            t += 0.1;
          }

          p0 = p3;
        }
      });
    }

    context.globalAlpha = element.opacity / 100;
    (element.shape as Drawable[]).forEach(shape => rc.draw(shape));
    context.globalAlpha = 1;
    return;
  } else if (element.type === "line") {
    const [x1, y1, x2, y2] = getLinePoints(element);
    const options = {
      stroke: element.strokeColor,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness,
      seed: element.seed
    };

    if (!element.shape) {
      element.shape = generator.line(x1, y1, x2, y2, options);
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (isTextElement(element)) {
    context.globalAlpha = element.opacity / 100;
    const font = context.font;
    context.font = element.font;
    const fillStyle = context.fillStyle;
    context.fillStyle = element.strokeColor;
    context.fillText(
      element.text,
      0,
      element.baseline || element.actualBoundingBoxAscent || 0
    );
    context.fillStyle = fillStyle;
    context.font = font;
    context.globalAlpha = 1;
  } else {
    throw new Error("Unimplemented type " + element.type);
  }
}
