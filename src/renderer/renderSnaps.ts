import { RenderConfig } from "../scene/types";
import { Snaps, snapProject } from "../snapping";
import * as GAPoints from "../gapoints";
import { Point } from "../types";

const SNAP_COLOR = "red";
const SNAP_WIDTH = 1;
const SNAP_CROSS_SIZE = 4.5;

interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

export const renderSnaps = (
  { renderConfig, context }: RenderSnapOptions,
  snaps: Snaps,
) => {
  context.save();

  context.lineWidth = SNAP_WIDTH / renderConfig.zoom.value;

  for (const { snapLine, point } of snaps) {
    context.strokeStyle = SNAP_COLOR;

    const from = GAPoints.toTuple(snapLine.point);

    const to = snapProject({
      origin: GAPoints.toObject(point),
      offset: { x: 0, y: 0 },
      snaps,
      zoom: renderConfig.zoom,
    });

    drawSnap(from, to, renderConfig.zoom, context);
  }

  context.restore();
};

const drawSnap = (
  from: Point,
  to: Point,
  zoom: RenderConfig["zoom"],
  context: CanvasRenderingContext2D,
) => {
  context.save();

  drawCross(from, zoom, context);

  context.beginPath();
  context.lineTo(...from);
  context.lineTo(...to);
  context.stroke();

  drawCross(to, zoom, context);

  context.restore();
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
