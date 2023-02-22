import * as GA from "../ga";
import * as GAPoints from "../gapoints";
import * as GALines from "../galines";
import { Zoom } from "../types";
import { shouldSnap, Snaps } from "../snapping";

export interface ProjectionOptions {
  zoom: Zoom;
  origin: { x: number; y: number };
  offset: { x: number; y: number };
  snaps: Snaps | null;
}

export const project = ({ origin, offset, snaps, zoom }: ProjectionOptions) => {
  if (!snaps) {
    return applyOffset({ origin, offset });
  }

  const snapLineMetadata = closestSnapLine(
    snaps,
    GA.offset(offset.x, offset.y),
  );

  if (!snapLineMetadata || !shouldSnap(snapLineMetadata, zoom)) {
    return applyOffset({ origin, offset });
  }

  const {
    snapLine: { line },
    origin: selectionReference,
  } = snapLineMetadata;

  const projectedPoint = GALines.orthogonalProjection(
    GA.add(selectionReference, GA.offset(offset.x, offset.y)),
    line,
  );

  const snapOffset = GA.sub(selectionReference, projectedPoint);
  const projection = GA.sub(GA.point(origin.x, origin.y), snapOffset);

  return GAPoints.toObject(projection);
};

const closestSnapLine = (snaps: Snaps, offset: GA.Point) => {
  const [closest] = snaps
    .map((snap) => {
      const origin = snap.point;
      const projection = GA.add(origin, offset);

      const distance = Math.abs(
        GAPoints.distanceToLine(projection, snap.snapLine.line),
      );

      return { ...snap, distance, origin, projection };
    })
    .sort((a, b) => a.distance - b.distance);

  return closest ?? null;
};

const applyOffset = ({
  origin,
  offset,
}: Pick<ProjectionOptions, "origin" | "offset">) => ({
  x: origin.x + offset.x,
  y: origin.y + offset.y,
});
