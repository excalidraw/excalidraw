import oc from "open-color";
import { RenderConfig } from "../scene/types";
import { Snaps, SnapLine, getSnapLineCoordinates } from "../snapping";
import * as GA from "../ga";
import * as GALines from "../galines";

const MAGNETISM_AXE_EXPANSION_FACTOR = 0.1;
// handle floating point errors
const PRECISION = 0.001;

export interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

const renderAxes = (
  { context, renderConfig }: RenderSnapOptions,
  { snaps }: { snaps: Snaps },
) => {
  context.lineWidth = 1 / renderConfig.zoom.value;

  // group axes to avoid rendering the same axe multiple times
  const axes = snaps.reduce((axes, { snapLine, point }) => {
    const axeIndex = axes.findIndex(
      (axe) =>
        GALines.areParallel(axe.snapLine.line, snapLine.line, PRECISION) &&
        GALines.distance(axe.snapLine.line, snapLine.line) < PRECISION,
    );

    if (axeIndex === -1) {
      axes.push({
        snapLine,
        points: [point],
      });
    } else {
      axes[axeIndex].points.push(point);
    }

    return axes;
  }, [] as { snapLine: SnapLine; points: GA.Point[] }[]);

  for (const { snapLine, points } of axes) {
    context.strokeStyle = renderConfig.selectionColor ?? oc.black;

    const { from, to } = getSnapLineCoordinates(
      {
        line: snapLine.line,
        points: [...points, ...snapLine.points],
      },
      MAGNETISM_AXE_EXPANSION_FACTOR,
    );

    context.beginPath();
    context.lineTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }
};

export const renderSnap = (
  { renderConfig, context }: RenderSnapOptions,
  { snaps }: { snaps: Snaps },
) => {
  context.save();

  renderAxes({ renderConfig, context }, { snaps });

  context.restore();
};
