import { RenderConfig } from "../scene/types";
import { PointSnapLine, PointerSnapLine, getSnapDistance } from "../snapping";
import { AppState, Point } from "../types";

const SNAP_COLOR = "#fa5252";
const SNAP_WIDTH = 2;
const SNAP_CROSS_SIZE = 3;

interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

export const renderSnaps = (
  { renderConfig, context }: RenderSnapOptions,
  appState: AppState,
) => {
  context.save();
  context.lineWidth = SNAP_WIDTH / renderConfig.zoom.value;
  context.strokeStyle = SNAP_COLOR;

  for (const snapLine of appState.snapLines) {
    if (snapLine.type === "points" || snapLine.type === "pointer") {
      drawPointSnap({ renderConfig, context }, snapLine);
    } else {
      drawGapLine(
        snapLine.points[0][0],
        snapLine.points[0][1],
        snapLine.direction,
        renderConfig.zoom,
        context,
      );

      drawGapLine(
        snapLine.points[1][0],
        snapLine.points[1][1],
        snapLine.direction,
        renderConfig.zoom,
        context,
      );
    }
  }

  context.restore();
};

const drawPointSnap = (
  { renderConfig, context }: RenderSnapOptions,
  pointSnapLine: PointSnapLine | PointerSnapLine,
) => {
  drawCross(pointSnapLine.points[0], renderConfig.zoom, context);
  drawLine(pointSnapLine.points[0], pointSnapLine.points[1], context);
  drawCross(pointSnapLine.points[1], renderConfig.zoom, context);
};

const drawCross = (
  [x, y]: Point,
  zoom: RenderConfig["zoom"],
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
  zoom: RenderConfig["zoom"],
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
