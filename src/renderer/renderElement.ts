import { withCustomMathRandom } from "../random";

import { ExcalidrawElement } from "../element/types";
import { isTextElement } from "../element/typeChecks";
import { getDiamondPoints, getArrowPoints } from "../element/bounds";
import { RoughCanvas } from "roughjs/bin/canvas";
import { Drawable } from "roughjs/bin/core";

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
      element.shape = withCustomMathRandom(element.seed, () => {
        return generator.rectangle(0, 0, element.width, element.height, {
          stroke: element.strokeColor,
          fill: element.backgroundColor,
          fillStyle: element.fillStyle,
          strokeWidth: element.strokeWidth,
          roughness: element.roughness
        });
      });
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (element.type === "diamond") {
    if (!element.shape) {
      element.shape = withCustomMathRandom(element.seed, () => {
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
        return generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY]
          ],
          {
            stroke: element.strokeColor,
            fill: element.backgroundColor,
            fillStyle: element.fillStyle,
            strokeWidth: element.strokeWidth,
            roughness: element.roughness
          }
        );
      });
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (element.type === "ellipse") {
    if (!element.shape) {
      element.shape = withCustomMathRandom(element.seed, () =>
        generator.ellipse(
          element.width / 2,
          element.height / 2,
          element.width,
          element.height,
          {
            stroke: element.strokeColor,
            fill: element.backgroundColor,
            fillStyle: element.fillStyle,
            strokeWidth: element.strokeWidth,
            roughness: element.roughness
          }
        )
      );
    }

    context.globalAlpha = element.opacity / 100;
    rc.draw(element.shape as Drawable);
    context.globalAlpha = 1;
  } else if (element.type === "arrow") {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = getArrowPoints(element);
    const options = {
      stroke: element.strokeColor,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness
    };

    if (!element.shape) {
      element.shape = withCustomMathRandom(element.seed, () => [
        //    \
        generator.line(x3, y3, x2, y2, options),
        // -----
        generator.line(x1, y1, x2, y2, options),
        //    /
        generator.line(x4, y4, x2, y2, options)
      ]);
    }

    context.globalAlpha = element.opacity / 100;
    (element.shape as Drawable[]).forEach(shape => rc.draw(shape));
    context.globalAlpha = 1;
    return;
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
