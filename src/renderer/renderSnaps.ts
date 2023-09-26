import { PointSnapLine, PointerSnapLine } from "../snapping";
import { InteractiveCanvasAppState, Point } from "../types";

const SNAP_COLOR_PRIMARY = "#ff6b6b";
const SNAP_WIDTH = 1;
const SNAP_CROSS_SIZE = 2;

export const renderSnaps = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  context.save();

  for (const snapLine of appState.snapLines) {
    if (snapLine.type === "pointer") {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_PRIMARY;

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
