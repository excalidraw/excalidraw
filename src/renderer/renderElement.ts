import rough from "roughjs/bin/wrappers/rough";

import { withCustomMathRandom } from "../random";

import { ExcalidrawElement } from "../element/types";
import { isTextElement } from "../element/typeChecks";
import { getDiamondPoints, getArrowPoints } from "../element/bounds";
import { RoughCanvas } from "roughjs/bin/canvas";
import { SceneState } from "../scene/types";

// Casting second argument (DrawingSurface) to any,
// because it is requred by TS definitions and not required at runtime
const generator = rough.generator(null, null as any);

export function renderElement(
  element: ExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  { scrollX, scrollY }: SceneState
) {
  if (element.type === "selection") {
    const fillStyle = context.fillStyle;
    context.fillStyle = "rgba(0, 0, 255, 0.10)";
    context.fillRect(
      element.x + scrollX,
      element.y + scrollY,
      element.width,
      element.height
    );
    context.fillStyle = fillStyle;
  } else if (element.type === "rectangle") {
    const shape = withCustomMathRandom(element.seed, () => {
      return generator.rectangle(0, 0, element.width, element.height, {
        stroke: element.strokeColor,
        fill: element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        roughness: element.roughness
      });
    });

    context.globalAlpha = element.opacity / 100;
    context.translate(element.x + scrollX, element.y + scrollY);
    rc.draw(shape);
    context.translate(-element.x - scrollX, -element.y - scrollY);
    context.globalAlpha = 1;
  } else if (element.type === "diamond") {
    const shape = withCustomMathRandom(element.seed, () => {
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
    context.globalAlpha = element.opacity / 100;
    context.translate(element.x + scrollX, element.y + scrollY);
    rc.draw(shape);
    context.translate(-element.x - scrollX, -element.y - scrollY);
    context.globalAlpha = 1;
  } else if (element.type === "ellipse") {
    const shape = withCustomMathRandom(element.seed, () =>
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

    context.globalAlpha = element.opacity / 100;
    context.translate(element.x + scrollX, element.y + scrollY);
    rc.draw(shape);
    context.translate(-element.x - scrollX, -element.y - scrollY);
    context.globalAlpha = 1;
  } else if (element.type === "arrow") {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = getArrowPoints(element);
    const options = {
      stroke: element.strokeColor,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness
    };

    const shapes = withCustomMathRandom(element.seed, () => [
      //    \
      generator.line(x3, y3, x2, y2, options),
      // -----
      generator.line(x1, y1, x2, y2, options),
      //    /
      generator.line(x4, y4, x2, y2, options)
    ]);

    context.globalAlpha = element.opacity / 100;
    context.translate(element.x + scrollX, element.y + scrollY);
    shapes.forEach(shape => rc.draw(shape));
    context.translate(-element.x - scrollX, -element.y - scrollY);
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
      element.x + scrollX,
      element.y +
        scrollY +
        (element.baseline || element.actualBoundingBoxAscent || 0)
    );
    context.fillStyle = fillStyle;
    context.font = font;
    context.globalAlpha = 1;
  } else if (element.type === "server") {
    const options = {
      stroke: element.strokeColor,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness
    };

    const w = element.width;
    const h = element.height;
    const shapes = withCustomMathRandom(element.seed, () => [
      generator.arc(w / 2, 0, w, h * 0.1, Math.PI, Math.PI * 2, false, options), // prettier-ignore
      generator.line(0, 0, 0, h, options),
      generator.arc(w / 2, h * 0.25, w, h * 0.1, Math.PI, Math.PI * 2, false, options), // prettier-ignore
      generator.line(0, h / 2, w, h / 2, options), // prettier-ignore
      generator.arc(w / 2, h * 0.75, w, h * 0.1, Math.PI * 2, Math.PI * 3, false, options), // prettier-ignore
      generator.line(w, 0, w, h, options), // prettier-ignore
      generator.arc(w / 2, h, w, h * 0.1, Math.PI * 2, Math.PI * 3, false, options) // prettier-ignore
    ]);

    context.globalAlpha = element.opacity / 100;
    context.translate(element.x + scrollX, element.y + scrollY);
    shapes.forEach(shape => rc.draw(shape));
    context.translate(-element.x - scrollX, -element.y - scrollY);
    context.globalAlpha = 1;
  } else {
    throw new Error("Unimplemented type " + element.type);
  }
}
