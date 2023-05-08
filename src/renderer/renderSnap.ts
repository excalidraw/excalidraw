import oc from "open-color";
import { RenderConfig } from "../scene/types";
import { Snaps, getSnapLineEndPointsCoords } from "../snapping";

interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

export const renderSnap = (
  { renderConfig, context }: RenderSnapOptions,
  { snaps }: { snaps: Snaps },
) => {
  context.save();

  context.lineWidth = 1 / renderConfig.zoom.value;

  for (const { snapLine, point } of snaps) {
    context.strokeStyle = renderConfig.selectionColor ?? oc.black;

    const { from, to } = getSnapLineEndPointsCoords({
      line: snapLine.line,
      points: [point, ...snapLine.points],
    });

    context.beginPath();
    context.lineTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  context.restore();
};
