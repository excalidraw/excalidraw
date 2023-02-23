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

// handle floating point errors
const PRECISION = 0.001;

export const project = ({ origin, offset, snaps, zoom }: ProjectionOptions) => {
  if (!snaps) {
    return GAPoints.toObject(
      GA.add(GA.point(origin.x, origin.y), GA.offset(offset.x, offset.y)),
    );
  }

  let totalOffset = GA.offset(0, 0);

  for (const snap of keepOnlyClosestPoints(snaps)) {
    if (!shouldSnap(snap, zoom)) {
      continue;
    }

    const snapReferencePoint = GA.add(snap.point, totalOffset);
    const snapProjection = GALines.orthogonalProjection(
      snapReferencePoint,
      snap.snapLine.line,
    );

    if (GA.isNaN(snapProjection)) {
      continue;
    }

    const snapOffset = GA.sub(snapReferencePoint, snapProjection);
    totalOffset = GA.sub(totalOffset, snapOffset);
  }

  return GAPoints.toObject(
    GA.add(
      GA.point(origin.x, origin.y),
      GA.add(totalOffset, GA.offset(offset.x, offset.y)),
    ),
  );
};

/**
 * Group all snap lines that are using the same axe (parallel and close enough)
 */
const keepOnlyClosestPoints = (snaps: Snaps) => {
  const groups = snaps.reduce((axes, snap) => {
    const axeIndex = axes.findIndex(
      (axe) =>
        GALines.areParallel(axe.snapLine.line, snap.snapLine.line, PRECISION) &&
        GALines.distance(axe.snapLine.line, snap.snapLine.line) < PRECISION,
    );

    if (axeIndex === -1) {
      axes.push(snap);
    } else if (snap.distance < axes[axeIndex].distance) {
      axes[axeIndex] = snap;
    }

    return axes;
  }, [] as Snaps);

  return groups;
};
