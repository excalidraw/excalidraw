import { RenderConfig } from "../scene/types";
import { isSnapped, Snap, SnapLine } from "../snapping";
import * as GA from "../ga";
import * as GALines from "../galines";
import * as GAPoints from "../gapoints";

const MAGNETISM_AXE_EXPANSION_FACTOR = 0.1;
// handle floating point errors
const PRECISION = 0.001;

export interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

const opacityToColor = (
  { renderConfig }: Pick<RenderSnapOptions, "renderConfig">,
  opacity: number,
) => {
  const hexOpacity = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${renderConfig.selectionColor}${hexOpacity}`;
};

const renderAxes = (
  { context, renderConfig }: RenderSnapOptions,
  { snap }: { snap: Snap },
) => {
  context.lineWidth = 1 / renderConfig.zoom.value;

  // group axes to avoid rendering the same axe multiple times
  const axes = snap.selectionToSnapLine.reduce((axes, { snapLine, point }) => {
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
    const opacity = isSnapped(snap, GAPoints.toTuple(snapLine.points[0]))
      ? 1
      : 0.3;
    context.strokeStyle = opacityToColor({ renderConfig }, opacity);

    const { from, to } = snapLine.fromTo(points);

    const deltaX = (to[0] - from[0]) * MAGNETISM_AXE_EXPANSION_FACTOR;
    const deltaY = (to[1] - from[1]) * MAGNETISM_AXE_EXPANSION_FACTOR;

    context.beginPath();
    context.lineTo(from[0] - deltaX, from[1] - deltaY);
    context.lineTo(to[0] + deltaX, to[1] + deltaY);
    context.stroke();
  }
};

export const renderSnap = (
  { renderConfig, context }: RenderSnapOptions,
  { snap }: { snap: Snap },
) => {
  context.save();

  renderAxes({ renderConfig, context }, { snap });

  context.restore();
};
