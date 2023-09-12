import { PointSnapLine, PointerSnapLine, getSnapDistance } from "../snapping";
import { InteractiveCanvasAppState, Point } from "../types";

const SNAP_COLOR_PRIMARY = "#fa5252";
const SNAP_COLOR_SECONDARY = "#ff8787";
const SNAP_WIDTH = 2;
const SNAP_CROSS_SIZE = 3;

export const renderSnaps = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  context.save();

  for (const snapLine of appState.snapLines) {
    if (snapLine.type === "points") {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_PRIMARY;

      drawPointsSnapLine(snapLine, context, appState);
    } else if (snapLine.type === "pointer") {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_SECONDARY;

      drawPointerSnapLine(snapLine, context, appState);
    } else {
      context.lineWidth = SNAP_WIDTH / appState.zoom.value;
      context.strokeStyle = SNAP_COLOR_PRIMARY;

      drawGapLine(
        snapLine.points[0][0],
        snapLine.points[0][1],
        snapLine.direction,
        appState.zoom,
        context,
      );

      drawGapLine(
        snapLine.points[1][0],
        snapLine.points[1][1],
        snapLine.direction,
        appState.zoom,
        context,
      );
    }
  }

  context.restore();
};

const drawPointsSnapLine = (
  pointSnapLine: PointSnapLine | PointerSnapLine,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  drawCross(pointSnapLine.points[0], appState.zoom, context);
  drawLine(pointSnapLine.points[0], pointSnapLine.points[1], context);
  if (pointSnapLine.type === "points") {
    drawCross(pointSnapLine.points[1], appState.zoom, context);
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
  // ⎸–––––––‖–––––––⎸

  const FULL = getSnapDistance(zoom.value);
  const HALF = FULL / 2;
  const QUARTER = FULL / 4;

  if (direction === "horizontal") {
    const halfPoint = [(from[0] + to[0]) / 2, from[1]];
    drawLine([from[0], from[1] - FULL], [from[0], from[1] + FULL], context);

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

    drawLine([to[0], to[1] - FULL], [to[0], to[1] + FULL], context);

    drawLine(from, to, context);
  } else {
    const halfPoint = [from[0], (from[1] + to[1]) / 2];
    drawLine([from[0] - FULL, from[1]], [from[0] + FULL, from[1]], context);

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

    drawLine([to[0] - FULL, to[1]], [to[0] + FULL, to[1]], context);

    drawLine(from, to, context);
  }
};
