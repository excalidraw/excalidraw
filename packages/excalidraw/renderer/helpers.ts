import { THEME, THEME_FILTER } from "@excalidraw/common";

import { FIXED_BINDING_DISTANCE } from "@excalidraw/element";
import { getDiamondPoints } from "@excalidraw/element";
import { elementCenterPoint, getCornerRadius } from "@excalidraw/element";

import {
  curve,
  curveCatmullRomCubicApproxPoints,
  curveCatmullRomQuadraticApproxPoints,
  curveOffsetPoints,
  type GlobalPoint,
  offsetPointsForQuadraticBezier,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";

import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawRectanguloidElement,
} from "@excalidraw/element/types";

import type { StaticCanvasRenderConfig } from "../scene/types";
import type { AppState, StaticCanvasAppState } from "../types";

export const fillCircle = (
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stroke: boolean,
  fill = true,
) => {
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  if (fill) {
    context.fill();
  }
  if (stroke) {
    context.stroke();
  }
};

export const getNormalizedCanvasDimensions = (
  canvas: HTMLCanvasElement,
  scale: number,
): [number, number] => {
  // When doing calculations based on canvas width we should used normalized one
  return [canvas.width / scale, canvas.height / scale];
};

export const bootstrapCanvas = ({
  canvas,
  scale,
  normalizedWidth,
  normalizedHeight,
  theme,
  isExporting,
  viewBackgroundColor,
}: {
  canvas: HTMLCanvasElement;
  scale: number;
  normalizedWidth: number;
  normalizedHeight: number;
  theme?: AppState["theme"];
  isExporting?: StaticCanvasRenderConfig["isExporting"];
  viewBackgroundColor?: StaticCanvasAppState["viewBackgroundColor"];
}): CanvasRenderingContext2D => {
  const context = canvas.getContext("2d")!;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(scale, scale);

  if (isExporting && theme === THEME.DARK) {
    context.filter = THEME_FILTER;
  }

  // Paint background
  if (typeof viewBackgroundColor === "string") {
    const hasTransparence =
      viewBackgroundColor === "transparent" ||
      viewBackgroundColor.length === 5 || // #RGBA
      viewBackgroundColor.length === 9 || // #RRGGBBA
      /(hsla|rgba)\(/.test(viewBackgroundColor);
    if (hasTransparence) {
      context.clearRect(0, 0, normalizedWidth, normalizedHeight);
    }
    context.save();
    context.fillStyle = viewBackgroundColor;
    context.fillRect(0, 0, normalizedWidth, normalizedHeight);
    context.restore();
  } else {
    context.clearRect(0, 0, normalizedWidth, normalizedHeight);
  }

  return context;
};

function drawCatmullRomQuadraticApprox(
  ctx: CanvasRenderingContext2D,
  points: GlobalPoint[],
  tension = 0.5,
) {
  const pointSets = curveCatmullRomQuadraticApproxPoints(points, tension);
  if (pointSets) {
    for (let i = 0; i < pointSets.length - 1; i++) {
      const [[cpX, cpY], [p2X, p2Y]] = pointSets[i];

      ctx.quadraticCurveTo(cpX, cpY, p2X, p2Y);
    }
  }
}

function drawCatmullRomCubicApprox(
  ctx: CanvasRenderingContext2D,
  points: GlobalPoint[],
  tension = 0.5,
) {
  const pointSets = curveCatmullRomCubicApproxPoints(points, tension);
  if (pointSets) {
    for (let i = 0; i < pointSets.length; i++) {
      const [[cp1x, cp1y], [cp2x, cp2y], [x, y]] = pointSets[i];
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
  }
}

export const drawHighlightForRectWithRotation = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawRectanguloidElement,
  elementsMap: ElementsMap,
  padding: number,
) => {
  const [x, y] = pointRotateRads(
    pointFrom<GlobalPoint>(element.x, element.y),
    elementCenterPoint(element, elementsMap),
    element.angle,
  );

  context.save();
  context.translate(x, y);
  context.rotate(element.angle);

  let radius = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );
  if (radius === 0) {
    radius = 0.01;
  }

  context.beginPath();

  {
    const topLeftApprox = offsetPointsForQuadraticBezier(
      pointFrom(0, 0 + radius),
      pointFrom(0, 0),
      pointFrom(0 + radius, 0),
      padding,
    );
    const topRightApprox = offsetPointsForQuadraticBezier(
      pointFrom(element.width - radius, 0),
      pointFrom(element.width, 0),
      pointFrom(element.width, radius),
      padding,
    );
    const bottomRightApprox = offsetPointsForQuadraticBezier(
      pointFrom(element.width, element.height - radius),
      pointFrom(element.width, element.height),
      pointFrom(element.width - radius, element.height),
      padding,
    );
    const bottomLeftApprox = offsetPointsForQuadraticBezier(
      pointFrom(radius, element.height),
      pointFrom(0, element.height),
      pointFrom(0, element.height - radius),
      padding,
    );

    context.moveTo(
      topLeftApprox[topLeftApprox.length - 1][0],
      topLeftApprox[topLeftApprox.length - 1][1],
    );
    context.lineTo(topRightApprox[0][0], topRightApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, topRightApprox);
    context.lineTo(bottomRightApprox[0][0], bottomRightApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, bottomRightApprox);
    context.lineTo(bottomLeftApprox[0][0], bottomLeftApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, bottomLeftApprox);
    context.lineTo(topLeftApprox[0][0], topLeftApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, topLeftApprox);
  }

  // Counter-clockwise for the cutout in the middle. We need to have an "inverse
  // mask" on a filled shape for the diamond highlight, because stroking creates
  // sharp inset edges on line joins < 90 degrees.
  {
    const topLeftApprox = offsetPointsForQuadraticBezier(
      pointFrom(0 + radius, 0),
      pointFrom(0, 0),
      pointFrom(0, 0 + radius),
      -FIXED_BINDING_DISTANCE,
    );
    const topRightApprox = offsetPointsForQuadraticBezier(
      pointFrom(element.width, radius),
      pointFrom(element.width, 0),
      pointFrom(element.width - radius, 0),
      -FIXED_BINDING_DISTANCE,
    );
    const bottomRightApprox = offsetPointsForQuadraticBezier(
      pointFrom(element.width - radius, element.height),
      pointFrom(element.width, element.height),
      pointFrom(element.width, element.height - radius),
      -FIXED_BINDING_DISTANCE,
    );
    const bottomLeftApprox = offsetPointsForQuadraticBezier(
      pointFrom(0, element.height - radius),
      pointFrom(0, element.height),
      pointFrom(radius, element.height),
      -FIXED_BINDING_DISTANCE,
    );

    context.moveTo(
      topLeftApprox[topLeftApprox.length - 1][0],
      topLeftApprox[topLeftApprox.length - 1][1],
    );
    context.lineTo(bottomLeftApprox[0][0], bottomLeftApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, bottomLeftApprox);
    context.lineTo(bottomRightApprox[0][0], bottomRightApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, bottomRightApprox);
    context.lineTo(topRightApprox[0][0], topRightApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, topRightApprox);
    context.lineTo(topLeftApprox[0][0], topLeftApprox[0][1]);
    drawCatmullRomQuadraticApprox(context, topLeftApprox);
  }

  context.closePath();
  context.fill();

  context.restore();
};

export const strokeEllipseWithRotation = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
) => {
  context.beginPath();
  context.ellipse(cx, cy, width / 2, height / 2, angle, 0, Math.PI * 2);
  context.stroke();
};

export const strokeRectWithRotation = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
  fill: boolean = false,
  /** should account for zoom */
  radius: number = 0,
) => {
  context.save();
  context.translate(cx, cy);
  context.rotate(angle);
  if (fill) {
    context.fillRect(x - cx, y - cy, width, height);
  }
  if (radius && context.roundRect) {
    context.beginPath();
    context.roundRect(x - cx, y - cy, width, height, radius);
    context.stroke();
    context.closePath();
  } else {
    context.strokeRect(x - cx, y - cy, width, height);
  }
  context.restore();
};

export const drawHighlightForDiamondWithRotation = (
  context: CanvasRenderingContext2D,
  padding: number,
  element: ExcalidrawDiamondElement,
  elementsMap: ElementsMap,
) => {
  const [x, y] = pointRotateRads(
    pointFrom<GlobalPoint>(element.x, element.y),
    elementCenterPoint(element, elementsMap),
    element.angle,
  );
  context.save();
  context.translate(x, y);
  context.rotate(element.angle);

  {
    context.beginPath();

    const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
      getDiamondPoints(element);
    const verticalRadius = element.roundness
      ? getCornerRadius(Math.abs(topX - leftX), element)
      : (topX - leftX) * 0.01;
    const horizontalRadius = element.roundness
      ? getCornerRadius(Math.abs(rightY - topY), element)
      : (rightY - topY) * 0.01;
    const topApprox = curveOffsetPoints(
      curve(
        pointFrom(topX - verticalRadius, topY + horizontalRadius),
        pointFrom(topX, topY),
        pointFrom(topX, topY),
        pointFrom(topX + verticalRadius, topY + horizontalRadius),
      ),
      padding,
    );
    const rightApprox = curveOffsetPoints(
      curve(
        pointFrom(rightX - verticalRadius, rightY - horizontalRadius),
        pointFrom(rightX, rightY),
        pointFrom(rightX, rightY),
        pointFrom(rightX - verticalRadius, rightY + horizontalRadius),
      ),
      padding,
    );
    const bottomApprox = curveOffsetPoints(
      curve(
        pointFrom(bottomX + verticalRadius, bottomY - horizontalRadius),
        pointFrom(bottomX, bottomY),
        pointFrom(bottomX, bottomY),
        pointFrom(bottomX - verticalRadius, bottomY - horizontalRadius),
      ),
      padding,
    );
    const leftApprox = curveOffsetPoints(
      curve(
        pointFrom(leftX + verticalRadius, leftY + horizontalRadius),
        pointFrom(leftX, leftY),
        pointFrom(leftX, leftY),
        pointFrom(leftX + verticalRadius, leftY - horizontalRadius),
      ),
      padding,
    );

    context.moveTo(
      topApprox[topApprox.length - 1][0],
      topApprox[topApprox.length - 1][1],
    );
    context.lineTo(rightApprox[1][0], rightApprox[1][1]);
    drawCatmullRomCubicApprox(context, rightApprox);
    context.lineTo(bottomApprox[1][0], bottomApprox[1][1]);
    drawCatmullRomCubicApprox(context, bottomApprox);
    context.lineTo(leftApprox[1][0], leftApprox[1][1]);
    drawCatmullRomCubicApprox(context, leftApprox);
    context.lineTo(topApprox[1][0], topApprox[1][1]);
    drawCatmullRomCubicApprox(context, topApprox);
  }

  // Counter-clockwise for the cutout in the middle. We need to have an "inverse
  // mask" on a filled shape for the diamond highlight, because stroking creates
  // sharp inset edges on line joins < 90 degrees.
  {
    const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
      getDiamondPoints(element);
    const verticalRadius = element.roundness
      ? getCornerRadius(Math.abs(topX - leftX), element)
      : (topX - leftX) * 0.01;
    const horizontalRadius = element.roundness
      ? getCornerRadius(Math.abs(rightY - topY), element)
      : (rightY - topY) * 0.01;
    const topApprox = curveOffsetPoints(
      curve(
        pointFrom(topX + verticalRadius, topY + horizontalRadius),
        pointFrom(topX, topY),
        pointFrom(topX, topY),
        pointFrom(topX - verticalRadius, topY + horizontalRadius),
      ),
      -FIXED_BINDING_DISTANCE,
    );
    const rightApprox = curveOffsetPoints(
      curve(
        pointFrom(rightX - verticalRadius, rightY + horizontalRadius),
        pointFrom(rightX, rightY),
        pointFrom(rightX, rightY),
        pointFrom(rightX - verticalRadius, rightY - horizontalRadius),
      ),
      -FIXED_BINDING_DISTANCE,
    );
    const bottomApprox = curveOffsetPoints(
      curve(
        pointFrom(bottomX - verticalRadius, bottomY - horizontalRadius),
        pointFrom(bottomX, bottomY),
        pointFrom(bottomX, bottomY),
        pointFrom(bottomX + verticalRadius, bottomY - horizontalRadius),
      ),
      -FIXED_BINDING_DISTANCE,
    );
    const leftApprox = curveOffsetPoints(
      curve(
        pointFrom(leftX + verticalRadius, leftY - horizontalRadius),
        pointFrom(leftX, leftY),
        pointFrom(leftX, leftY),
        pointFrom(leftX + verticalRadius, leftY + horizontalRadius),
      ),
      -FIXED_BINDING_DISTANCE,
    );

    context.moveTo(
      topApprox[topApprox.length - 1][0],
      topApprox[topApprox.length - 1][1],
    );
    context.lineTo(leftApprox[1][0], leftApprox[1][1]);
    drawCatmullRomCubicApprox(context, leftApprox);
    context.lineTo(bottomApprox[1][0], bottomApprox[1][1]);
    drawCatmullRomCubicApprox(context, bottomApprox);
    context.lineTo(rightApprox[1][0], rightApprox[1][1]);
    drawCatmullRomCubicApprox(context, rightApprox);
    context.lineTo(topApprox[1][0], topApprox[1][1]);
    drawCatmullRomCubicApprox(context, topApprox);
  }
  context.closePath();
  context.fill();
  context.restore();
};
