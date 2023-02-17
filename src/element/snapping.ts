import * as GA from "../ga";
import * as GADirections from "../gadirections";
import * as GAPoints from "../gapoints";
import * as GALines from "../galines";
import { Snap } from "../snapping";

export interface ProjectionOptions {
  origin: { x: number; y: number };
  offset: { x: number; y: number };
  snap: Snap | null;
}

export const project = ({ origin, offset, snap }: ProjectionOptions) => {
  if (!snap) {
    return applyOffset({ origin, offset });
  }

  const snapLineMetadata = closestSnapLine(snap, GA.offset(offset.x, offset.y));

  if (!snapLineMetadata || snapLineMetadata.distance > 30) {
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

const closestSnapLine = (snap: Snap, offset: GA.Point) => {
  const [closest] = snap.selectionToSnapLine
    .map(({ snapLine, point }) => {
      const origin = point;
      const projection = GA.add(origin, offset);

      const distance = Math.abs(
        GAPoints.distanceToLine(projection, snapLine.line),
      );

      return { distance, origin, projection, snapLine };
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
