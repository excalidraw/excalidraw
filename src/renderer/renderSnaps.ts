import { RenderConfig } from "../scene/types";
import { getSnapThreshold, snapProject, snapToPoint } from "../snapping";
import * as GAPoints from "../gapoints";
import { AppState, Point } from "../types";
import { getSelectedElements } from "../scene";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getCommonBounds, getElementBounds } from "../element";
import { rangeIntersection } from "../math";

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
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  context.save();
  context.lineWidth = SNAP_WIDTH / renderConfig.zoom.value;
  context.strokeStyle = SNAP_COLOR;

  drawPointSnaps({ renderConfig, context }, appState, elements);
  drawGapSnaps({ renderConfig, context }, appState, elements);

  context.restore();
};

const drawPointSnaps = (
  { renderConfig, context }: RenderSnapOptions,
  appState: AppState,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const pointSnaps = appState.snaps ?? [];

  for (const snap of appState.snaps ?? []) {
    const from = GAPoints.toTuple(snap.snapLine.point);
    const to = appState.isResizing
      ? // || (appState.draggingElement && appState.activeTool.type !== "selection")
        snapToPoint(snap)
      : snapProject({
          origin: GAPoints.toObject(snap.point),
          snaps: pointSnaps,
          zoom: renderConfig.zoom,
        });

    drawCross(from, renderConfig.zoom, context);
    drawLine(from, to, context);
    drawCross(to, renderConfig.zoom, context);
  }
};

const drawGapSnaps = (
  { renderConfig, context }: RenderSnapOptions,
  appState: AppState,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const selectedElements = getSelectedElements(elements, appState);
  const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);

  for (const gapSnap of appState.gapSnaps) {
    const [startMinX, startMinY, startMaxX, startMaxY] = getElementBounds(
      gapSnap.gap.startElement,
    );
    const [endMinX, endMinY, endMaxX, endMaxY] = getElementBounds(
      gapSnap.gap.endElement,
    );

    const verticalIntersection = rangeIntersection(
      [minY, maxY],
      gapSnap.gap.intersection,
    );

    const horizontalGapIntersection = rangeIntersection(
      [minX, maxX],
      gapSnap.gap.intersection,
    );

    switch (gapSnap.direction) {
      case "center_horizontal": {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          context.save();
          drawGapLine(
            [gapSnap.gap.startEdge[0][0], gapLineY],
            [minX, gapLineY],
            "horizontal",
            renderConfig.zoom,
            context,
          );
          drawGapLine(
            [maxX, gapLineY],
            [gapSnap.gap.endEdge[0][0], gapLineY],
            "horizontal",
            renderConfig.zoom,
            context,
          );
          context.restore();
        }
        break;
      }
      case "center_vertical": {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          context.save();
          drawGapLine(
            [gapLineX, gapSnap.gap.startEdge[0][1]],
            [gapLineX, minY],
            "vertical",
            renderConfig.zoom,
            context,
          );
          drawGapLine(
            [gapLineX, maxY],
            [gapLineX, gapSnap.gap.endEdge[0][1]],
            "vertical",
            renderConfig.zoom,
            context,
          );
          context.restore();
        }
        break;
      }
      case "side_right": {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          context.save();
          drawGapLine(
            [startMaxX, gapLineY],
            [endMinX, gapLineY],
            "horizontal",
            renderConfig.zoom,
            context,
          );
          drawGapLine(
            [endMaxX, gapLineY],
            [minX, gapLineY],
            "horizontal",
            renderConfig.zoom,
            context,
          );
          context.restore();
        }
        break;
      }
      case "side_left": {
        if (verticalIntersection) {
          const gapLineY =
            (verticalIntersection[0] + verticalIntersection[1]) / 2;

          context.save();
          drawGapLine(
            [maxX, gapLineY],
            [startMinX, gapLineY],
            "horizontal",
            renderConfig.zoom,
            context,
          );
          drawGapLine(
            [startMaxX, gapLineY],
            [endMinX, gapLineY],
            "horizontal",
            renderConfig.zoom,
            context,
          );
          context.restore();
        }
        break;
      }
      case "side_top": {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          context.save();

          drawGapLine(
            [gapLineX, maxY],
            [gapLineX, startMinY],
            "vertical",
            renderConfig.zoom,
            context,
          );
          drawGapLine(
            [gapLineX, startMaxY],
            [gapLineX, endMinY],
            "vertical",
            renderConfig.zoom,
            context,
          );
          context.restore();
        }
        break;
      }
      case "side_bottom": {
        if (horizontalGapIntersection) {
          const gapLineX =
            (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;

          context.save();

          drawGapLine(
            [gapLineX, startMaxY],
            [gapLineX, endMinY],
            "vertical",
            renderConfig.zoom,
            context,
          );
          drawGapLine(
            [gapLineX, endMaxY],
            [gapLineX, minY],
            "vertical",
            renderConfig.zoom,
            context,
          );
          context.restore();
        }
        break;
      }
      default: {
        throw Error("Gap snap left unredered");
      }
    }
  }
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

  const FULL = getSnapThreshold(zoom.value);
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
