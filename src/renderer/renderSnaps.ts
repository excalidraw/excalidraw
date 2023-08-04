import { RenderConfig } from "../scene/types";
import { snapProject, snapToPoint } from "../snapping";
import * as GAPoints from "../gapoints";
import { AppState, Point } from "../types";

const SNAP_COLOR = "#fa5252";
const SNAP_WIDTH = 1;
const SNAP_CROSS_SIZE = 2;

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
  context.strokeStyle = SNAP_COLOR;
  for (const snap of snaps) {
    drawSnap(
      GAPoints.toTuple(snap.snapLine.point),
      appState.isResizing
        ? // || (appState.draggingElement && appState.activeTool.type !== "selection")
          snapToPoint(snap)
        : snapProject({
            origin: GAPoints.toObject(snap.point),
            snaps,
            zoom: renderConfig.zoom,
          }),
      renderConfig.zoom,
      context,
    );
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
  drawLine(from, to, context);
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
