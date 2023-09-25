import { PointSnapLine, PointerSnapLine, SnapLine } from "../snapping";
import { InteractiveCanvasAppState, Point } from "../types";

const SNAP_COLOR_PRIMARY = "#fa5252";
const SNAP_COLOR_SECONDARY = "#ff8787";
const SNAP_WIDTH = 1;
const SNAP_CROSS_SIZE = 2;

function mergeLines(snapLines: SnapLine[]): SnapLine[] {
  if (!snapLines.length) {
    return snapLines;
  }

  const result: SnapLine[] = [];
  const lines: PointSnapLine[] = snapLines.filter(
    (l) => l.type === "points",
  ) as PointSnapLine[];

  if (!lines.length) {
    return snapLines;
  }

  while (lines.length > 0) {
    const currentLine = lines.pop()!;
    let merged = false;

    for (let i = 0; i < lines.length; i++) {
      if (isOverlapping(currentLine, lines[i])) {
        const newLine: SnapLine = {
          type: "points",
          points: [
            [
              Math.min(
                currentLine.points[0][0],
                currentLine.points[1][0],
                lines[i].points[0][0],
                lines[i].points[1][0],
              ),
              Math.min(
                currentLine.points[0][1],
                currentLine.points[1][1],
                lines[i].points[0][1],
                lines[i].points[1][1],
              ),
            ],
            [
              Math.max(
                currentLine.points[0][0],
                currentLine.points[1][0],
                lines[i].points[0][0],
                lines[i].points[1][0],
              ),
              Math.max(
                currentLine.points[0][1],
                currentLine.points[1][1],
                lines[i].points[0][1],
                lines[i].points[1][1],
              ),
            ],
          ],
        };
        lines[i] = newLine;
        merged = true;
        break;
      }
    }

    if (!merged) {
      result.push(currentLine);
    }
  }

  // ddd back other types
  result.push(...snapLines.filter((l) => l.type !== "points"));

  return result;
}

function isOverlapping(line1: PointSnapLine, line2: PointSnapLine): boolean {
  const [l1StartX, l1EndX] =
    line1.points[0][0] <= line1.points[1][0]
      ? [line1.points[0][0], line1.points[1][0]]
      : [line1.points[1][0], line1.points[0][0]];
  const [l1StartY, l1EndY] =
    line1.points[0][1] <= line1.points[1][1]
      ? [line1.points[0][1], line1.points[1][1]]
      : [line1.points[1][1], line1.points[0][1]];

  const [l2StartX, l2EndX] =
    line2.points[0][0] <= line2.points[1][0]
      ? [line2.points[0][0], line2.points[1][0]]
      : [line2.points[1][0], line2.points[0][0]];
  const [l2StartY, l2EndY] =
    line2.points[0][1] <= line2.points[1][1]
      ? [line2.points[0][1], line2.points[1][1]]
      : [line2.points[1][1], line2.points[0][1]];

  // Vertical overlap
  if (l1StartX === l1EndX && l2StartX === l2EndX && l1StartX === l2StartX) {
    return (
      (l1StartY <= l2EndY && l1EndY >= l2StartY) ||
      (l2StartY <= l1EndY && l2EndY >= l1StartY)
    );
  }

  // Horizontal overlap
  if (l1StartY === l1EndY && l2StartY === l2EndY && l1StartY === l2StartY) {
    return (
      (l1StartX <= l2EndX && l1EndX >= l2StartX) ||
      (l2StartX <= l1EndX && l2EndX >= l1StartX)
    );
  }

  return false;
}

export const renderSnaps = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  context.save();

  const snapLines = mergeLines(appState.snapLines);

  for (const snapLine of snapLines) {
    if (snapLine.type === "pointer") {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_SECONDARY;

      drawPointerSnapLine(snapLine, context, appState);
    } else if (snapLine.type === "gap") {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_PRIMARY;

      drawGapLine(
        snapLine.points[0],
        snapLine.points[1],
        snapLine.direction,
        appState.zoom,
        context,
      );
    } else if (snapLine.type === "points") {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_PRIMARY;
      drawPointsSnapLine(snapLine, context, appState);
    }
  }

  context.restore();
};

const drawPointsSnapLine = (
  pointSnapLine: PointSnapLine,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  const firstPoint = pointSnapLine.points[0];
  const lastPoint = pointSnapLine.points[pointSnapLine.points.length - 1];

  drawLine(firstPoint, lastPoint, context);

  for (const point of pointSnapLine.points) {
    drawCross(point, appState.zoom, context);
  }
};

const drawPointerSnapLine = (
  pointerSnapLine: PointerSnapLine,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  drawCross(pointerSnapLine.points[0], appState.zoom, context);
  drawLine(pointerSnapLine.points[0], pointerSnapLine.points[1], context);
};

const drawCross = (
  [x, y]: Point,
  zoom: InteractiveCanvasAppState["zoom"],
  context: CanvasRenderingContext2D,
) => {
  context.save();
  const size = SNAP_CROSS_SIZE / zoom.value;
  context.beginPath();

  context.moveTo(x - size, y - size);
  context.lineTo(x + size, y + size);

  context.moveTo(x + size, y - size);
  context.lineTo(x - size, y + size);

  context.stroke();
  context.restore();
};

const drawLine = (
  from: Point,
  to: Point,
  context: CanvasRenderingContext2D,
) => {
  context.beginPath();
  context.lineTo(...from);
  context.lineTo(...to);
  context.stroke();
};

const drawGapLine = (
  from: Point,
  to: Point,
  direction: "horizontal" | "vertical",
  zoom: InteractiveCanvasAppState["zoom"],
  context: CanvasRenderingContext2D,
) => {
  // a horizontal gap snap line
  // |–––––––||–––––––|
  // ^    ^   ^       ^
  // \    \   \       \
  // (1)  (2) (3)     (4)

  const FULL = 8 / zoom.value;
  const HALF = FULL / 2;
  const QUARTER = FULL / 4;

  if (direction === "horizontal") {
    const halfPoint = [(from[0] + to[0]) / 2, from[1]];
    // (1)
    drawLine([from[0], from[1] - FULL], [from[0], from[1] + FULL], context);

    // (3)
    drawLine(
      [halfPoint[0] - QUARTER, halfPoint[1] - HALF],
      [halfPoint[0] - QUARTER, halfPoint[1] + HALF],
      context,
    );
    drawLine(
      [halfPoint[0] + QUARTER, halfPoint[1] - HALF],
      [halfPoint[0] + QUARTER, halfPoint[1] + HALF],
      context,
    );

    // (4)
    drawLine([to[0], to[1] - FULL], [to[0], to[1] + FULL], context);

    // (2)
    drawLine(from, to, context);
  } else {
    const halfPoint = [from[0], (from[1] + to[1]) / 2];
    // (1)
    drawLine([from[0] - FULL, from[1]], [from[0] + FULL, from[1]], context);

    // (3)
    drawLine(
      [halfPoint[0] - HALF, halfPoint[1] - QUARTER],
      [halfPoint[0] + HALF, halfPoint[1] - QUARTER],
      context,
    );
    drawLine(
      [halfPoint[0] - HALF, halfPoint[1] + QUARTER],
      [halfPoint[0] + HALF, halfPoint[1] + QUARTER],
      context,
    );

    // (4)
    drawLine([to[0] - FULL, to[1]], [to[0] + FULL, to[1]], context);

    // (2)
    drawLine(from, to, context);
  }
};
