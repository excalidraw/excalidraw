/**
 * Text bound to an arrow endpoint — creating a text element that reads as a
 * label for the tip of an arrow, placed and anchored so the arrow itself never
 * moves.
 *
 * The App-side interaction (hover affordance, hit gating, creation/drag entry
 * points) lives in `App.arrowText.ts`; the generic binding bookkeeping these
 * helpers rely on stays in `binding.ts`.
 */
import { TEXT_ALIGN, VERTICAL_ALIGN } from "@excalidraw/common";

import {
  pointDistance,
  pointFromVector,
  pointsEqual,
  vector,
  vectorDot,
  vectorFromPoint,
  vectorNormalize,
  vectorScale,
} from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";

import type { AppState } from "@excalidraw/excalidraw/types";

import { getBindingGap, normalizeFixedPoint } from "./binding";
import {
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  compareHeading,
} from "./heading";
import { LinearElementEditor } from "./linearElementEditor";
import { getTextAnchorRatios } from "./newElement";
import { isArrowElement, isElbowArrow } from "./typeChecks";

import type { Heading } from "./heading";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawTextElement,
  FixedPoint,
  NonDeleted,
  NonDeletedExcalidrawElement,
  TextAlign,
  VerticalAlign,
} from "./types";

export type ArrowEndpoint = {
  arrow: NonDeleted<ExcalidrawArrowElement>;
  startOrEnd: "start" | "end";
};

/**
 * Finds a free (unbound) arrow endpoint under the cursor, front-most first.
 * Used by the text tool to offer creating a text label anchored to the tip of
 * an arrow.
 */
export const getUnboundArrowEndpointAtPoint = (
  scenePointer: GlobalPoint,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  zoom: AppState["zoom"],
): ArrowEndpoint | null => {
  // front to back, so the top-most arrow wins when endpoints overlap
  for (let index = elements.length - 1; index >= 0; index--) {
    const element = elements[index];

    if (
      !isArrowElement(element) ||
      element.locked ||
      element.points.length < 2
    ) {
      continue;
    }

    // prefer the end (arrowhead) over the start when both are within range
    for (const startOrEnd of ["end", "start"] as const) {
      if (element[startOrEnd === "start" ? "startBinding" : "endBinding"]) {
        continue;
      }

      // a zero-length tail has no direction to place a text along, so
      // `getTextBindingForArrowEndpoint` would refuse the endpoint — don't
      // offer it at all rather than highlight something a click won't honor
      if (
        pointsEqual(
          element.points[
            startOrEnd === "start" ? 0 : element.points.length - 1
          ],
          element.points[
            startOrEnd === "start" ? 1 : element.points.length - 2
          ],
        )
      ) {
        continue;
      }

      const point = LinearElementEditor.getPointAtIndexGlobalCoordinates(
        element,
        startOrEnd === "start" ? 0 : -1,
        elementsMap,
      );

      // same reach as grabbing a point handle in the linear editor
      // (`LinearElementEditor.getPointIndexUnderCursor`), which can't be
      // reused here: it reports whichever point is nearest, with no way to
      // skip an endpoint that is already bound and fall through to the other
      if (
        pointDistance(scenePointer, point) * zoom.value <
        LinearElementEditor.POINT_HANDLE_SIZE + 1
      ) {
        return { arrow: element, startOrEnd };
      }
    }
  }

  return null;
};

/**
 * Describes how a text element should be created so that it reads as a label
 * for the given arrow endpoint.
 *
 * The arrow is treated as fixed: rather than routing the arrow to the text, we
 * pick the side of the text the arrow should attach to (the one it already
 * points at), and place the text so that side's midpoint lands on the existing
 * endpoint. The alignment returned pins that same midpoint while the text is
 * typed, so the arrow doesn't swing around during editing.
 */
export const getTextBindingForArrowEndpoint = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
  /**
   * stroke width the text will be created with — the binding gap is derived
   * from the *bind target*, so using the arrow's would offset the anchor by
   * half the difference between the two
   */
  targetStrokeWidth: number,
): {
  /** the text-local ratio the arrow binds to (a side midpoint) */
  fixedPoint: FixedPoint;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  /** scene position the text's bound side midpoint should sit at */
  anchor: GlobalPoint;
} | null => {
  const endpoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow,
    startOrEnd === "start" ? 0 : -1,
    elementsMap,
  );
  const neighbor = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow,
    startOrEnd === "start" ? 1 : -2,
    elementsMap,
  );

  if (pointsEqual(endpoint, neighbor)) {
    return null;
  }

  // The direction the arrow travels as it reaches this endpoint, snapped to
  // the dominant axis — i.e. the direction the text should extend away from
  // the tip.
  //
  // Deliberately not `vectorToHeading`: its tie-break resolves an exact 45°
  // vector to a direction the arrow isn't travelling in at all (a perfectly
  // down-right vector yields UP), which would put the text on the wrong side.
  // Here a tie picks the horizontal axis, always with the correct sign.
  const direction = vectorFromPoint(endpoint, neighbor);
  const heading: Heading =
    Math.abs(direction[0]) >= Math.abs(direction[1])
      ? direction[0] >= 0
        ? HEADING_RIGHT
        : HEADING_LEFT
      : direction[1] >= 0
      ? HEADING_DOWN
      : HEADING_UP;

  // Keep the tip off the text's bounding box by the usual binding gap so the
  // arrowhead doesn't collide with the glyphs. Must match the gap
  // `updateBoundPoint` will resolve the binding with, or the first text update
  // shifts the arrow. Elbow arrows terminate on the fixed point itself rather
  // than gap-outside the outline, so offsetting there would just shift them.
  const gap = isElbowArrow(arrow)
    ? 0
    : getBindingGap({ strokeWidth: targetStrokeWidth }, arrow);

  // How far back along the arrow the bound side has to sit for the tip to
  // stay exactly where it is.
  //
  // `updateBoundPoint` resolves an orbit binding by intersecting the arrow's
  // own line with the target's outline grown by `gap`; it does not step along
  // the bound side's normal. Offsetting the anchor perpendicular to the side
  // would therefore leave the tip `gap * tan(angle)` off to one side on a
  // diagonal arrow. Walking back along the arrow instead keeps the anchor both
  // `gap` clear of the tip and collinear with the arrow, so the intersection
  // lands back on the tip itself.
  //
  // `heading` is the dominant axis of the arrow direction, so it is never more
  // than 45° away from it and the divisor stays >= cos(45°).
  const awayFromTip = vectorNormalize(vectorFromPoint(neighbor, endpoint));
  const alongHeading = Math.abs(
    vectorDot(awayFromTip, vector(heading[0], heading[1])),
  );
  const anchor = pointFromVector(
    vectorScale(awayFromTip, -gap / alongHeading),
    endpoint,
  );

  if (compareHeading(heading, HEADING_RIGHT)) {
    // text sits to the right of the tip -> bind its left side
    return {
      fixedPoint: normalizeFixedPoint([0, 0.5]),
      anchor,
      textAlign: TEXT_ALIGN.LEFT as TextAlign,
      verticalAlign: VERTICAL_ALIGN.MIDDLE as VerticalAlign,
    };
  }

  if (compareHeading(heading, HEADING_LEFT)) {
    // text sits to the left of the tip -> bind its right side
    return {
      fixedPoint: normalizeFixedPoint([1, 0.5]),
      anchor,
      textAlign: TEXT_ALIGN.RIGHT as TextAlign,
      verticalAlign: VERTICAL_ALIGN.MIDDLE as VerticalAlign,
    };
  }

  if (compareHeading(heading, HEADING_DOWN)) {
    // text sits below the tip -> bind its top side
    return {
      fixedPoint: normalizeFixedPoint([0.5, 0]),
      anchor,
      textAlign: TEXT_ALIGN.CENTER as TextAlign,
      verticalAlign: VERTICAL_ALIGN.TOP as VerticalAlign,
    };
  }

  // text sits above the tip -> bind its bottom side
  return {
    fixedPoint: normalizeFixedPoint([0.5, 1]),
    anchor,
    textAlign: TEXT_ALIGN.CENTER as TextAlign,
    verticalAlign: VERTICAL_ALIGN.BOTTOM as VerticalAlign,
  };
};

/**
 * Whether an arrow endpoint is bound to this text — i.e. the text serves as an
 * arrow-endpoint label. Checked on the arrows' own bindings: the text's
 * `boundElements` only says an arrow relates to it, while the binding on the
 * arrow is the authoritative side of the relationship.
 */
export const isEndpointBoundText = (
  text: ExcalidrawTextElement,
  elementsMap: ElementsMap,
): boolean =>
  !!text.boundElements?.some(({ id, type }) => {
    if (type !== "arrow") {
      return false;
    }

    const arrow = elementsMap.get(id);

    return (
      isArrowElement(arrow) &&
      (arrow.startBinding?.elementId === text.id ||
        arrow.endBinding?.elementId === text.id)
    );
  });

/** the anchor a text bound to an arrow endpoint grows away from */
export const getEndpointBoundTextDragAnchor = (
  newElement: ExcalidrawTextElement,
) => {
  const anchorRatio = getTextAnchorRatios(newElement).x;

  return {
    anchorRatio,
    anchorX: newElement.x + newElement.width * anchorRatio,
  };
};
