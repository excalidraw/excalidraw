import React from "react";
import { distanceBetweenPointAndSegment } from "../utils/distanceBetweenPointAndSegment";
import { CanvasElement } from "./Canvas";

type RectangleProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  fillColor?: string;
  onHover?(): void;
  onTap?(): void;
};

export function Rectangle({
  x,
  y,
  width,
  height,
  strokeColor,
  fillColor,
  onHover,
  onTap
}: RectangleProps) {
  return (
    <CanvasElement
      x={x}
      y={y}
      hitTest={(targetX, targetY) => {
        const x1 = Math.min(x, x + width);
        const x2 = Math.max(x, x + width);
        const y1 = Math.min(y, y + height);
        const y2 = Math.max(y, y + height);
        return rectHitTest(targetX, targetY, x1, y1, x2, y2);
      }}
      getShape={rc =>
        rc.generator.rectangle(0, 0, width, height, {
          stroke: strokeColor,
          fill: fillColor
        })
      }
      draw={(rc, context, shape) => {
        rc.draw(shape!);
      }}
      onHover={onHover}
      onTap={onTap}
    />
  );
}

function rectHitTest(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const lineThreshold = 10;
  return (
    distanceBetweenPointAndSegment(x, y, x1, y1, x2, y1) < lineThreshold || // A
    distanceBetweenPointAndSegment(x, y, x2, y1, x2, y2) < lineThreshold || // B
    distanceBetweenPointAndSegment(x, y, x2, y2, x1, y2) < lineThreshold || // C
    distanceBetweenPointAndSegment(x, y, x1, y2, x1, y1) < lineThreshold // D
  );
}
