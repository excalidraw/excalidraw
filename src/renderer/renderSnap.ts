import oc from "open-color";
import { RenderConfig } from "../scene/types";
import { Snaps, getSnapLineEndPointsCoords } from "../snapping";
import { ExcalidrawElement } from "../element/types";
import { getElementsHandleCoordinates } from "../element/bounds";
import * as GA from "../ga";

interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

export const renderSnap = (
  { renderConfig, context }: RenderSnapOptions,
  snaps: Snaps,
  selectedElements: ExcalidrawElement[],
) => {
  context.save();

  context.lineWidth = 1 / renderConfig.zoom.value;

  for (const { snapLine, direction } of snaps) {
    context.strokeStyle = renderConfig.selectionColor ?? oc.black;

    const handles = getElementsHandleCoordinates(selectedElements);

    const { from, to } = getSnapLineEndPointsCoords({
      line: snapLine.line,
      points: [GA.point(...handles[direction]), ...snapLine.points],
    });

    context.beginPath();
    context.lineTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  context.restore();
};
