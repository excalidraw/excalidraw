import { RenderConfig } from "../scene/types";
import {
  areRoughlyEqual,
  getSnapThreshold,
  snapProject,
  snapToPoint,
} from "../snapping";
import * as GAPoints from "../gapoints";
import { AppState, Point } from "../types";
import { distance2d } from "../math";

const SNAP_COLOR = "#fa5252";
const SNAP_WIDTH = 1;
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

  const snaps = appState.snaps ?? [];

  context.lineWidth = SNAP_WIDTH / renderConfig.zoom.value;

  for (const snap of snaps) {
    context.strokeStyle = SNAP_COLOR;

    if (appState.isResizing) {
      areRoughlyEqual(snap.distance, 0) &&
        drawSnap(
          GAPoints.toTuple(snap.snapLine.point),
          snapToPoint(snap),
          renderConfig.zoom,
          context,
        );
    } else {
      drawSnap(
        GAPoints.toTuple(snap.snapLine.point),
        snapProject({
          origin: GAPoints.toObject(snap.point),
          snaps,
          zoom: renderConfig.zoom,
        }),
        renderConfig.zoom,
        context,
      );
    }
  }

  context.restore();
};

const drawSnap = (
  from: Point,
  to: Point,
  zoom: RenderConfig["zoom"],
  context: CanvasRenderingContext2D,
) => {
  const snapThreshold = getSnapThreshold(zoom.value);

  if (distance2d(...from, ...to) >= snapThreshold) {
    context.save();
    context.save();

    context.save();

    drawCross(from, zoom, context);

    context.beginPath();
    context.lineTo(...from);
    context.lineTo(...to);
    context.stroke();

    drawCross(to, zoom, context);

    context.restore();
  }
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
