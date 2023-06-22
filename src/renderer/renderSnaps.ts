import oc from "open-color";
import { RenderConfig } from "../scene/types";
import { Snaps, getSnapLineEndPointsCoords } from "../snapping";
import { ExcalidrawElement } from "../element/types";
import { getElementsBoundingBoxHandles } from "../element/bounds";
import * as GA from "../ga";

interface RenderSnapOptions {
  renderConfig: RenderConfig;
  context: CanvasRenderingContext2D;
}

export const renderSnaps = (
  { renderConfig, context }: RenderSnapOptions,
  snaps: Snaps,
  selectedElements: ExcalidrawElement[],
) => {
  context.save();

  context.lineWidth = 1 / renderConfig.zoom.value;

  const snapsByIdMap = new Map<string, Snaps>();
  snaps.forEach((snap) => {
    snapsByIdMap.set(snap.id, [...(snapsByIdMap.get(snap.id) ?? []), snap]);
  });

  const handles = getElementsBoundingBoxHandles(selectedElements);

  for (const snapsById of snapsByIdMap.values()) {
    context.strokeStyle = renderConfig.selectionColor ?? oc.black;
    const _points = Array.from(
      new Set(
        snapsById.flatMap((snap) => [
          GA.point(...handles[snap.direction]),
          ...snap.snapLine.points,
        ]),
      ),
    );

    const { from, to } = getSnapLineEndPointsCoords({
      ...snapsById[0].snapLine,
      points: _points,
    });

    context.beginPath();
    context.lineTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  context.restore();
};
